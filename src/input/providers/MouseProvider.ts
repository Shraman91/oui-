import { InputManager } from '../InputManager';
import { InputProvider } from './InputProvider';
import { INPUT_CONSTANTS } from '../constants';
import { clamp, lerp } from '../../shared/smoothing';

export class MouseProvider implements InputProvider {
  public readonly id = 'mouse';
  public readonly name = 'Mouse & Keyboard';

  private inputManager: InputManager;
  private container: HTMLElement | Window;

  private isRunning = false;
  private targetPointer = { x: 0.5, y: 0.5 };
  private currentPointer = { x: 0.5, y: 0.5 };
  private lastPointer = { x: 0.5, y: 0.5 };
  private currentTilt = { roll: 0, pitch: 0 };
  private lastSwingTime = 0;

  private keysHeld = new Set<string>();

  // Event handler references for cleanup
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onMouseDownBound: (e: MouseEvent) => void;
  private onMouseUpBound: (e: MouseEvent) => void;
  private onContextMenuBound: (e: MouseEvent) => void;
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;

  constructor(inputManager: InputManager, container?: HTMLElement) {
    this.inputManager = inputManager;
    this.container = container || window;

    this.onMouseMoveBound = this.handleMouseMove.bind(this);
    this.onMouseDownBound = this.handleMouseDown.bind(this);
    this.onMouseUpBound = this.handleMouseUp.bind(this);
    this.onContextMenuBound = this.handleContextMenu.bind(this);
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    this.onKeyUpBound = this.handleKeyUp.bind(this);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    window.addEventListener('mousemove', this.onMouseMoveBound);
    window.addEventListener('mousedown', this.onMouseDownBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
    window.addEventListener('contextmenu', this.onContextMenuBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mousedown', this.onMouseDownBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
    window.removeEventListener('contextmenu', this.onContextMenuBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);

    this.keysHeld.clear();
    this.inputManager.updateState({
      buttonA: false,
      buttonB: false
    });
  }

  public update(dt: number): void {
    if (!this.isRunning || dt <= 0) return;

    const isMousePrimary = this.inputManager.getActiveProvider()?.id === 'mouse';
    const isRecentlyActive = this.inputManager.isMouseRecentlyActive(800);

    // If another provider (like Phone) is active and mouse is idle, sync coords and yield
    if (!isMousePrimary && !isRecentlyActive) {
      const cur = this.inputManager.getState().pointer;
      this.currentPointer.x = cur.x;
      this.currentPointer.y = cur.y;
      this.targetPointer.x = cur.x;
      this.targetPointer.y = cur.y;
      this.lastPointer.x = cur.x;
      this.lastPointer.y = cur.y;
      return;
    }

    // 1. Pointer smoothing (EMA)
    const alpha = INPUT_CONSTANTS.MOUSE.POINTER_ALPHA;
    // Frame-rate independent exponential smoothing factor
    const smoothingFactor = 1 - Math.pow(1 - alpha, dt * 60);
    this.currentPointer.x = lerp(this.currentPointer.x, this.targetPointer.x, smoothingFactor);
    this.currentPointer.y = lerp(this.currentPointer.y, this.targetPointer.y, smoothingFactor);

    // 2. Velocity calculation (normalized screen delta per second)
    const dx = this.currentPointer.x - this.lastPointer.x;
    const dy = this.currentPointer.y - this.lastPointer.y;
    const vx = dx / dt;
    const vy = dy / dt;
    const speed = Math.hypot(vx, vy);

    this.lastPointer.x = this.currentPointer.x;
    this.lastPointer.y = this.currentPointer.y;

    // 3. Swing detection
    const now = performance.now();
    if (
      speed >= INPUT_CONSTANTS.MOUSE.SWING_SPEED_THRESHOLD &&
      now - this.lastSwingTime >= INPUT_CONSTANTS.MOUSE.SWING_COOLDOWN_MS
    ) {
      this.lastSwingTime = now;
      this.inputManager.emit('swing', {
        speed,
        direction: {
          x: vx / speed,
          y: vy / speed
        }
      });
    }

    // 4. Keyboard tilt mapping (WASD / Arrows)
    let targetRoll = 0;
    let targetPitch = 0;

    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) targetRoll -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) targetRoll += 1;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) targetPitch -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) targetPitch += 1;

    const tiltSpeed = INPUT_CONSTANTS.MOUSE.TILT_LERP_SPEED * dt;
    this.currentTilt.roll = lerp(this.currentTilt.roll, targetRoll, tiltSpeed);
    this.currentTilt.pitch = lerp(this.currentTilt.pitch, targetPitch, tiltSpeed);

    // 5. Update InputManager state
    this.inputManager.updateState({
      pointer: { ...this.currentPointer },
      pointerVelocity: { x: vx, y: vy },
      tilt: { ...this.currentTilt }
    });
  }

  private handleMouseMove(e: MouseEvent): void {
    this.inputManager.notifyMouseActivity();
    let width = window.innerWidth;
    let height = window.innerHeight;

    if (this.container instanceof HTMLElement) {
      const rect = this.container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const normalizedX = clamp((e.clientX - rect.left) / width, 0, 1);
      const normalizedY = clamp((e.clientY - rect.top) / height, 0, 1);
      this.targetPointer.x = normalizedX;
      this.targetPointer.y = normalizedY;
      return;
    }

    this.targetPointer.x = clamp(e.clientX / width, 0, 1);
    this.targetPointer.y = clamp(e.clientY / height, 0, 1);
  }

  private handleMouseDown(e: MouseEvent): void {
    this.inputManager.notifyMouseActivity();
    if (e.button === 0) {
      // Left click = Button A
      this.inputManager.updateState({ buttonA: true });
      this.inputManager.emit('pressA', undefined);
    } else if (e.button === 2) {
      // Right click = Button B
      this.inputManager.updateState({ buttonB: true });
      this.inputManager.emit('pressB', undefined);
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.inputManager.updateState({ buttonA: false });
      this.inputManager.emit('releaseA', undefined);
    } else if (e.button === 2) {
      this.inputManager.updateState({ buttonB: false });
      this.inputManager.emit('releaseB', undefined);
    }
  }

  private handleContextMenu(e: MouseEvent): void {
    // Prevent standard context menu so right click can be used as Button B freely
    e.preventDefault();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    this.keysHeld.add(e.code);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keysHeld.delete(e.code);
  }
}
