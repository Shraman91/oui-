import { InputManager } from '../InputManager';
import { InputProvider } from './InputProvider';
import { RelayClient } from '../network/RelayClient';
import { SensorBar } from '../sensorbar/SensorBar';
import { SENSORBAR_CONSTANTS } from '../sensorbar/sensorbar.constants';
import { clamp } from '../../shared/smoothing';

export class PhoneProvider implements InputProvider {
  public readonly id = 'phone';
  public readonly name = 'Wii Remote (Phone)';

  private inputManager: InputManager;
  private sensorBar: SensorBar;
  private relayClient: RelayClient;

  private isRunning = false;
  private lastSwingTime = 0;
  private unsubSensorData?: () => void;
  private unsubButtonEvent?: () => void;
  private unsubRecenter?: () => void;
  private unsubRumble?: () => void;

  constructor(inputManager: InputManager, sensorBar: SensorBar, relayClient: RelayClient) {
    this.inputManager = inputManager;
    this.sensorBar = sensorBar;
    this.relayClient = relayClient;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Process ~60 Hz incoming sensor packets from phone
    this.unsubSensorData = this.relayClient.onSensorData((remoteId, packet) => {
      if (!this.isRunning || remoteId !== 1) return;

      const state = this.sensorBar.update(packet);

      // Normalize tilt [-1, 1] for steering games (Space Fighter)
      const maxTilt = SENSORBAR_CONSTANTS.tiltNormalizationMaxDeg;
      const roll = clamp(state.filteredAngles.roll / maxTilt, -1, 1);
      const pitch = clamp((state.filteredAngles.pitch - state.centerAngles.pitch) / maxTilt, -1, 1);

      // Swing Gesture Detection
      const now = performance.now();
      const accel = packet.accel || packet.accelG;
      if (accel) {
        const mag = Math.hypot(accel.x, accel.y, accel.z);
        if (
          mag >= SENSORBAR_CONSTANTS.swingThreshold &&
          now - this.lastSwingTime >= SENSORBAR_CONSTANTS.swingCooldownMs
        ) {
          this.lastSwingTime = now;
          this.inputManager.emit('swing', {
            speed: mag,
            direction: {
              x: mag > 0 ? accel.x / mag : 0,
              y: mag > 0 ? -accel.y / mag : 1
            }
          });
        }
      }

      // If mouse or trackpad is being actively moved by user on PC, yield pointer to mouse
      if (this.inputManager.isMouseRecentlyActive(800)) {
        return;
      }

      // If phone sensors have no valid motion data (offline / 0°), do not force pointer
      if (!this.sensorBar.hasValidMotion()) {
        return;
      }

      // Update InputManager state so Cursor and games read phone pointer
      this.inputManager.updateState({
        pointer: { ...state.pointer },
        pointerVelocity: { ...state.pointerVelocity },
        tilt: { roll, pitch }
      });
    });

    // 2. Immediate Button Events (A, B triggers)
    this.unsubButtonEvent = this.relayClient.onButtonEvent((remoteId, event) => {
      if (!this.isRunning || remoteId !== 1) return;

      if (event.button === 'A') {
        const isDown = event.state === 'down';
        this.inputManager.updateState({ buttonA: isDown });
        if (isDown) {
          this.inputManager.emit('pressA', undefined);
        } else {
          this.inputManager.emit('releaseA', undefined);
        }
      } else if (event.button === 'B') {
        const isDown = event.state === 'down';
        this.inputManager.updateState({ buttonB: isDown });
        if (isDown) {
          this.inputManager.emit('pressB', undefined);
        } else {
          this.inputManager.emit('releaseB', undefined);
        }
      }
    });

    // 3. Recenter event from phone
    this.unsubRecenter = this.relayClient.onRecenter((remoteId) => {
      if (!this.isRunning || remoteId !== 1) return;
      this.sensorBar.recenter();
      this.relayClient.sendRumble(1, { duration: 90 });
    });

    // 4. Rumble feedback: console requests rumble -> forward to phone
    this.unsubRumble = this.inputManager.onRumble((strength, durationMs) => {
      if (this.isRunning) {
        this.relayClient.sendRumble(1, { duration: durationMs, strength });
      }
    });
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    this.unsubSensorData?.();
    this.unsubButtonEvent?.();
    this.unsubRecenter?.();
    this.unsubRumble?.();

    this.inputManager.updateState({
      buttonA: false,
      buttonB: false
    });
  }

  public update(_dt: number): void {
    if (!this.isRunning) return;
    // State is continuously driven by 60Hz incoming packets
  }
}
