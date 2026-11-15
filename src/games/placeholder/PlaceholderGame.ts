import { Game } from '../../core/Game';
import { InputManager, SwingEventPayload } from '../../input/InputManager';

export class PlaceholderGame implements Game {
  public readonly id: string;
  public readonly title: string;

  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private inputManager: InputManager | null = null;

  private unsubSwing: (() => void) | null = null;
  private swingRipples: Array<{ x: number; y: number; radius: number; alpha: number; color: string }> = [];
  private totalTime = 0;

  constructor(id: string, title: string) {
    this.id = id;
    this.title = title;
  }

  public init(container: HTMLElement, inputManager: InputManager): void {
    this.container = container;
    this.inputManager = inputManager;

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.background = '#0f172a';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.resize();

    window.addEventListener('resize', this.handleResize);

    // Subscribe to swing events to test motion feedback
    this.unsubSwing = this.inputManager.on('swing', (payload: SwingEventPayload) => {
      this.handleSwing(payload);
    });
  }

  private handleResize = (): void => {
    this.resize();
  };

  private resize(): void {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  private handleSwing(payload: SwingEventPayload): void {
    if (!this.inputManager || !this.canvas) return;
    const pointer = this.inputManager.getState().pointer;
    const rect = this.canvas.getBoundingClientRect();

    this.swingRipples.push({
      x: pointer.x * rect.width,
      y: pointer.y * rect.height,
      radius: 10,
      alpha: 1.0,
      color: payload.speed > 4 ? '#f43f5e' : '#38bdf8'
    });
  }

  public update(dt: number): void {
    this.totalTime += dt;

    // Update swing ripple animations
    for (const ripple of this.swingRipples) {
      ripple.radius += dt * 180;
      ripple.alpha -= dt * 1.8;
    }
    this.swingRipples = this.swingRipples.filter((r) => r.alpha > 0);
  }

  public render(): void {
    if (!this.canvas || !this.ctx || !this.inputManager) return;
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // Background subtle grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Render swing ripples
    for (const ripple of this.swingRipples) {
      ctx.save();
      ctx.strokeStyle = ripple.color;
      ctx.globalAlpha = Math.max(0, ripple.alpha);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const state = this.inputManager.getState();
    const px = state.pointer.x * w;
    const py = state.pointer.y * h;

    // Center header text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Comfortaa", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.title} (Phase 1 Channel Test)`, w / 2, 70);

    ctx.font = '16px "Nunito", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Move pointer & click (A=Left, B=Right). Flick mouse for Swing. Press ESC to Pause.', w / 2, 105);

    // Draw Tilt Indicator
    const tiltCenterX = w / 2;
    const tiltCenterY = h / 2 + 30;
    const tiltRadius = 60;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tiltCenterX, tiltCenterY, tiltRadius, 0, Math.PI * 2);
    ctx.stroke();

    const tiltX = tiltCenterX + state.tilt.roll * tiltRadius;
    const tiltY = tiltCenterY + state.tilt.pitch * tiltRadius;

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(tiltX, tiltY, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px monospace';
    ctx.fillText(`Tilt (WASD/Arrows): Roll ${state.tilt.roll.toFixed(2)} | Pitch ${state.tilt.pitch.toFixed(2)}`, tiltCenterX, tiltCenterY + tiltRadius + 30);

    // Draw Button Status Badges
    const btnBoxY = tiltCenterY + tiltRadius + 60;
    ctx.fillStyle = state.buttonA ? '#22c55e' : '#334155';
    ctx.fillRect(w / 2 - 110, btnBoxY, 100, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('A (Left Click)', w / 2 - 60, btnBoxY + 23);

    ctx.fillStyle = state.buttonB ? '#3b82f6' : '#334155';
    ctx.fillRect(w / 2 + 10, btnBoxY, 100, 36);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('B (Right Click)', w / 2 + 60, btnBoxY + 23);

    // Draw Pointer Cursor
    ctx.save();
    ctx.fillStyle = state.buttonA ? '#f59e0b' : '#38bdf8';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fill();

    // Inner core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();

    // Velocity line
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + state.pointerVelocity.x * 0.05, py + state.pointerVelocity.y * 0.05);
    ctx.stroke();
    ctx.restore();
  }

  public pause(): void {
    // Pauses animation or timers if needed
  }

  public resume(): void {
    // Resumes animation or timers if needed
  }

  public destroy(): void {
    window.removeEventListener('resize', this.handleResize);
    if (this.unsubSwing) {
      this.unsubSwing();
      this.unsubSwing = null;
    }
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.container = null;
  }
}
