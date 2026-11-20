import type { SensorPacket } from '../network/types';

export const SENSORBAR_CONSTANTS = {
  // Field of view / angle span to cover the full screen
  yawRangeDeg: 60,           // ±30° natural wrist arc for comfortable aiming
  pitchRangeDeg: 42,         // ±21° up/down

  // Sensitivity bounds
  defaultSensitivity: 1.0,
  minSensitivity: 0.4,
  maxSensitivity: 2.5,

  // 3-stage stabilization pipeline
  // Stage 1 (angle pre-filter): EMA coefficient on the raw angle stream
  angleEmaCoeff: 0.18,       // Slow, stabilizing: only 18% of new angle per tick
  // Stage 2 (angle deadzone): Below this angular change, filtered angles do NOT update
  angleDeadZoneDeg: 0.60,    // 0.60° — absorbs hand tremor + cheap IMU noise
  // Stage 3 (screen deadzone): Below this normalized distance, cursor HOLDS position
  screenDeadZone: 0.020,     // ~0.020 = ~38px on 1920px screen. Rock-solid stillness.
  // Stage 4 (adaptive EMA on screen coords)
  minSmoothingAlpha: 0.05,   // Nearly frozen when barely moving
  maxSmoothingAlpha: 0.50,   // Snappy when making big sweeps
  // Speed threshold scale: dist * speedScale must reach 1.0 for max responsiveness
  speedScale: 6.0,

  // Screen clamping bounds
  screenMinX: 0.0,
  screenMaxX: 1.0,
  screenMinY: 0.0,
  screenMaxY: 1.0,

  // Gestures (Used in Step 4)
  swingThreshold: 17.5,
  swingCooldownMs: 300,
  shakeThreshold: 24.0,
  tiltNormalizationMaxDeg: 35
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

    // Auto-center on the first packet that contains real orientation readings
    if (!this.isCalibrated) {
      if (Math.abs(rawYaw) > 0.001 || Math.abs(rawPitch) > 0.001 || Math.abs(rawRoll) > 0.001) {
        this.centerAngles.yaw = rawYaw;
        this.centerAngles.pitch = rawPitch;
        this.filteredAngles = { yaw: rawYaw, pitch: rawPitch, roll: rawRoll };
        this.isCalibrated = true;
      }
    }

    // 1. Angular pre-filter — EMA on angles, gated by deadzone
    // This is the console-side "Stage 1+2": absorbs residual noise after phone smoothing.
    const dYaw = ((rawYaw - this.filteredAngles.yaw + 540) % 360) - 180;
    const dPitch = rawPitch - this.filteredAngles.pitch;
    const dRoll = rawRoll - this.filteredAngles.roll;

    const angleDeadzone = this.constants.angleDeadZoneDeg;
    const angleEma = this.constants.angleEmaCoeff;
    if (Math.abs(dYaw) > angleDeadzone) {
      this.filteredAngles.yaw = (this.filteredAngles.yaw + dYaw * angleEma + 360) % 360;
    }
    if (Math.abs(dPitch) > angleDeadzone) {
      this.filteredAngles.pitch += dPitch * angleEma;
    }
    if (Math.abs(dRoll) > angleDeadzone) {
      this.filteredAngles.roll += dRoll * angleEma;
    }

    // 2. Calculate angular deltas relative to calibrated center
    const deltaYaw = ((this.filteredAngles.yaw - this.centerAngles.yaw + 540) % 360) - 180;
    const deltaPitch = this.filteredAngles.pitch - this.centerAngles.pitch;

    // 3. Map angular deltas to screen space (0.0 to 1.0)
    const effectiveYawRange = this.constants.yawRangeDeg / this.sensitivity;
    const effectivePitchRange = this.constants.pitchRangeDeg / this.sensitivity;

    // Aiming right (positive yaw) -> cursor moves right (positive X)
    // Aiming down (tilting phone forward / lower pitch) -> cursor moves down (positive Y)
    let targetX = 0.5 + deltaYaw / effectiveYawRange;
    let targetY = 0.5 - deltaPitch / effectivePitchRange;

    // Clamp to screen bounds
    targetX = Math.max(this.constants.screenMinX, Math.min(this.constants.screenMaxX, targetX));
    targetY = Math.max(this.constants.screenMinY, Math.min(this.constants.screenMaxY, targetY));

    // 4. Screen-space Dead Zone (locks cursor rock-solid when holding phone still)
    const dx = targetX - this.pointer.x;
    const dy = targetY - this.pointer.y;
    const dist = Math.hypot(dx, dy);

    if (dist < this.constants.screenDeadZone) {
      targetX = this.pointer.x;
      targetY = this.pointer.y;
    }

    // 5. Adaptive Dynamic EMA (1-Euro style)
    // dist is in normalized screen space. At rest (<screenDeadZone) it's 0.
    // scale goes 0→1 as motion increases, saturating at speedScale.
    const speedFactor = Math.min(1.0, dist * this.constants.speedScale);
    const alpha = this.constants.minSmoothingAlpha + speedFactor * (this.constants.maxSmoothingAlpha - this.constants.minSmoothingAlpha);

    const newX = this.pointer.x + alpha * (targetX - this.pointer.x);
    const newY = this.pointer.y + alpha * (targetY - this.pointer.y);

    // 6. Calculate pointer velocity
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
