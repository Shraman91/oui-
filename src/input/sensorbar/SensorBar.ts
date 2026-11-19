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
  smoothingAlpha: 0.32,      // Exponential Moving Average weight (buttery smooth and instant response)
  deadZone: 0.0015,          // Normalized screen distance under which cursor holds still

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

    // Modern mobile devices (iOS / Android) already perform hardware IMU Kalman sensor fusion.
    // Tracking raw orientation directly provides instantaneous pointer response without filter drag.
    this.filteredAngles.yaw = rawYaw;
    this.filteredAngles.pitch = rawPitch;
    this.filteredAngles.roll = rawRoll;

    // Auto-center on the first packet that contains real orientation readings
    if (!this.isCalibrated) {
      if (Math.abs(rawYaw) > 0.001 || Math.abs(rawPitch) > 0.001 || Math.abs(rawRoll) > 0.001) {
        this.recenter();
      }
    }

    // 1. Calculate angular deltas relative to calibrated center
    // Wrapped yaw delta [-180, 180]
    const deltaYaw = ((this.filteredAngles.yaw - this.centerAngles.yaw + 540) % 360) - 180;
    const deltaPitch = this.filteredAngles.pitch - this.centerAngles.pitch;

    // 2. Map angular deltas to screen space (0.0 to 1.0)
    const effectiveYawRange = this.constants.yawRangeDeg / this.sensitivity;
    const effectivePitchRange = this.constants.pitchRangeDeg / this.sensitivity;

    // Aiming right (positive yaw) -> cursor moves right (positive X)
    // Aiming down (tilting phone forward / lower pitch) -> cursor moves down (positive Y)
    let targetX = 0.5 + deltaYaw / effectiveYawRange;
    let targetY = 0.5 - deltaPitch / effectivePitchRange;

    // Clamp to screen bounds
    targetX = Math.max(this.constants.screenMinX, Math.min(this.constants.screenMaxX, targetX));
    targetY = Math.max(this.constants.screenMinY, Math.min(this.constants.screenMaxY, targetY));

    // 3. Dead zone filter (eliminates micro-tremors when holding phone still)
    const dx = targetX - this.pointer.x;
    const dy = targetY - this.pointer.y;
    const dist = Math.hypot(dx, dy);

    if (dist < this.constants.deadZone) {
      targetX = this.pointer.x;
      targetY = this.pointer.y;
    }

    // 4. Exponential Moving Average (EMA) smoothing for rock-steady motion
    const alpha = this.constants.smoothingAlpha;
    const newX = this.pointer.x + alpha * (targetX - this.pointer.x);
    const newY = this.pointer.y + alpha * (targetY - this.pointer.y);

    // 5. Calculate pointer velocity
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

  public hasValidMotion(): boolean {
    return (
      Math.abs(this.rawAngles.yaw) > 0.001 ||
      Math.abs(this.rawAngles.pitch) > 0.001 ||
      Math.abs(this.rawAngles.roll) > 0.001
    );
  }

  public setPointer(x: number, y: number): void {
    this.pointer.x = Math.max(0, Math.min(1, x));
    this.pointer.y = Math.max(0, Math.min(1, y));
  }

  public reset(): void {
    this.pointer = { x: 0.5, y: 0.5 };
    this.pointerVelocity = { x: 0.0, y: 0.0 };
    this.isCalibrated = false;
    this.lastPacketTime = 0;
  }
}
