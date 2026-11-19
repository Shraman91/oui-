import type { SensorPacket } from '../network/types';

export const SENSORBAR_CONSTANTS = {
  // Field of view / angle span to cover the full screen
  yawRangeDeg: 42,           // Moving ±21° left/right covers 100% of the screen width
  pitchRangeDeg: 30,         // Moving ±15° up/down covers 100% of the screen height

  // Sensitivity bounds
  defaultSensitivity: 1.0,
  minSensitivity: 0.4,
  maxSensitivity: 2.5,

  // Smoothing & dead zone
  smoothingAlpha: 0.28,      // Exponential Moving Average weight (0.28 is responsive without jitter)
  deadZone: 0.002,           // Normalized screen distance under which cursor holds still

  // Complementary filter weights
  gyroWeight: 0.94,          // Gyroscope high-pass response weight (responsiveness)
  orientationWeight: 0.06,   // Accelerometer/orientation low-pass drift correction weight
  maxDeltaTimeSec: 0.1,      // Reset filter if packet gap exceeds 100ms

  // Screen clamping bounds
  screenMinX: 0.0,
  screenMaxX: 1.0,
  screenMinY: 0.0,
  screenMaxY: 1.0,

  // Gestures (Used in Step 4)
  swingThreshold: 17.5,      // Acceleration magnitude (m/s²) threshold to trigger a swing
  swingCooldownMs: 300,      // Minimum delay between consecutive swings
  shakeThreshold: 24.0,      // Acceleration magnitude for shake gesture (clear canvas)
  tiltNormalizationMaxDeg: 35 // ±35° mapped to -1..1 tilt
} as const;

export type SensorBarConfig = typeof SENSORBAR_CONSTANTS;

export interface SensorBarState {
  pointer: { x: number; y: number };
  pointerVelocity: { x: number; y: number };
  rawAngles: { yaw: number; pitch: number; roll: number };
  filteredAngles: { yaw: number; pitch: number; roll: number };
  centerAngles: { yaw: number; pitch: number };
  isCalibrated: boolean;
  lastPacketTime: number;
}

export class SensorBar {
  private constants = SENSORBAR_CONSTANTS;
  private sensitivity: number;

  private pointer: { x: number; y: number } = { x: 0.5, y: 0.5 };
  private pointerVelocity: { x: number; y: number } = { x: 0.0, y: 0.0 };
  private rawAngles: { yaw: number; pitch: number; roll: number } = { yaw: 0, pitch: 0, roll: 0 };
  private filteredAngles: { yaw: number; pitch: number; roll: number } = { yaw: 0, pitch: 0, roll: 0 };
  private centerAngles: { yaw: number; pitch: number } = { yaw: 0, pitch: 0 };
  private isCalibrated = false;
  private lastPacketTime = 0;

  constructor(initialSensitivity: number = SENSORBAR_CONSTANTS.defaultSensitivity) {
    this.sensitivity = Math.max(
      this.constants.minSensitivity,
      Math.min(this.constants.maxSensitivity, initialSensitivity)
    );
  }

  /**
   * Processes an incoming ~60 Hz sensor packet and returns the updated pointer & angle state.
   */
  public update(packet: SensorPacket): SensorBarState {
    const now = packet.t;
    const dt = this.lastPacketTime > 0 ? (now - this.lastPacketTime) / 1000 : 0.016;
    this.lastPacketTime = now;

    const rawYaw = packet.orientation.alpha;
    const rawPitch = packet.orientation.beta;
    const rawRoll = packet.orientation.gamma;

    this.rawAngles = { yaw: rawYaw, pitch: rawPitch, roll: rawRoll };

    // 1. Complementary Filter (Fuse gyro rate with absolute orientation)
    const hasGyro =
      packet.rotationRate &&
      (Math.abs(packet.rotationRate.alpha) > 0.001 ||
        Math.abs(packet.rotationRate.beta) > 0.001 ||
        Math.abs(packet.rotationRate.gamma) > 0.001);

    if (this.isCalibrated && hasGyro && dt < this.constants.maxDeltaTimeSec && dt > 0.001) {
      const gyroWeight = this.constants.gyroWeight;

      // Predicted angle using gyro rate integration (rotationRate is in deg/s)
      const gyroDeltaYaw = (packet.rotationRate?.alpha || 0) * dt;
      const gyroDeltaPitch = (packet.rotationRate?.beta || 0) * dt;
      const gyroDeltaRoll = (packet.rotationRate?.gamma || 0) * dt;

      const predictedYaw = this.filteredAngles.yaw + gyroDeltaYaw;
      const predictedPitch = this.filteredAngles.pitch + gyroDeltaPitch;
      const predictedRoll = this.filteredAngles.roll + gyroDeltaRoll;

      // Wrapped yaw error [-180, 180]
      const yawError = ((rawYaw - predictedYaw + 540) % 360) - 180;
      this.filteredAngles.yaw = (predictedYaw + (1 - gyroWeight) * yawError + 360) % 360;

      // Pitch and roll complementary blend
      this.filteredAngles.pitch = gyroWeight * predictedPitch + (1 - gyroWeight) * rawPitch;
      this.filteredAngles.roll = gyroWeight * predictedRoll + (1 - gyroWeight) * rawRoll;
    } else {
      // First packet or gyro unavailable: Direct orientation assignment
      this.filteredAngles.yaw = rawYaw;
      this.filteredAngles.pitch = rawPitch;
      this.filteredAngles.roll = rawRoll;
    }

    // 2. Auto-center on the very first packet
    if (!this.isCalibrated) {
      this.recenter();
    }

    // 3. Calculate angular deltas relative to center
    // Wrapped yaw delta [-180, 180]
    const deltaYaw = ((this.filteredAngles.yaw - this.centerAngles.yaw + 540) % 360) - 180;
    const deltaPitch = this.filteredAngles.pitch - this.centerAngles.pitch;

    // 4. Map angular deltas to screen space (0.0 to 1.0)
    const effectiveYawRange = this.constants.yawRangeDeg / this.sensitivity;
    const effectivePitchRange = this.constants.pitchRangeDeg / this.sensitivity;

    // Aiming right (positive yaw) -> cursor moves right (positive X)
    // Aiming down (forward tilt / decreased pitch) -> cursor moves down (positive Y)
    let targetX = 0.5 + deltaYaw / effectiveYawRange;
    let targetY = 0.5 - deltaPitch / effectivePitchRange;

    // Clamp to screen bounds
    targetX = Math.max(this.constants.screenMinX, Math.min(this.constants.screenMaxX, targetX));
    targetY = Math.max(this.constants.screenMinY, Math.min(this.constants.screenMaxY, targetY));

    // 5. Dead zone filter (eliminates micro-jitter when holding still)
    const dx = targetX - this.pointer.x;
    const dy = targetY - this.pointer.y;
    const dist = Math.hypot(dx, dy);

    if (dist < this.constants.deadZone) {
      targetX = this.pointer.x;
      targetY = this.pointer.y;
    }

    // 6. Exponential Moving Average (EMA) smoothing
    const alpha = this.constants.smoothingAlpha;
    const newX = this.pointer.x + alpha * (targetX - this.pointer.x);
    const newY = this.pointer.y + alpha * (targetY - this.pointer.y);

    // 7. Calculate pointer velocity
    if (dt > 0.001) {
      this.pointerVelocity.x = (newX - this.pointer.x) / dt;
      this.pointerVelocity.y = (newY - this.pointer.y) / dt;
    }

    this.pointer.x = newX;
    this.pointer.y = newY;

    return this.getState();
  }

  /**
   * Recalibrates the center reference yaw & pitch (like pointing at the Wii Sensor Bar).
   */
  public recenter(customYaw?: number, customPitch?: number): void {
    this.centerAngles.yaw = customYaw !== undefined ? customYaw : this.filteredAngles.yaw;
    this.centerAngles.pitch = customPitch !== undefined ? customPitch : this.filteredAngles.pitch;
    this.pointer = { x: 0.5, y: 0.5 };
    this.pointerVelocity = { x: 0.0, y: 0.0 };
    this.isCalibrated = true;
  }

  public setSensitivity(s: number): void {
    this.sensitivity = Math.max(
      this.constants.minSensitivity,
      Math.min(this.constants.maxSensitivity, s)
    );
  }

  public getSensitivity(): number {
    return this.sensitivity;
  }

  public getState(): SensorBarState {
    return {
      pointer: { ...this.pointer },
      pointerVelocity: { ...this.pointerVelocity },
      rawAngles: { ...this.rawAngles },
      filteredAngles: { ...this.filteredAngles },
      centerAngles: { ...this.centerAngles },
      isCalibrated: this.isCalibrated,
      lastPacketTime: this.lastPacketTime
    };
  }

  public reset(): void {
    this.pointer = { x: 0.5, y: 0.5 };
    this.pointerVelocity = { x: 0.0, y: 0.0 };
    this.isCalibrated = false;
    this.lastPacketTime = 0;
  }
}
