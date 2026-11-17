import './cursor.css';
import { InputManager } from './InputManager';

export interface CursorOptions {
  inputManager: InputManager;
  container?: HTMLElement;
  showPlayerBadge?: boolean;
}

export class Cursor {
  private inputManager: InputManager;
  private container: HTMLElement;
  private cursorElement: HTMLElement | null = null;
  private isHovering = false;
  private showPlayerBadge: boolean;

  private unsubPressA?: () => void;
  private unsubReleaseA?: () => void;
  private rafId: number | null = null;

  constructor(options: CursorOptions) {
    this.inputManager = options.inputManager;
    this.container = options.container || document.body;
    this.showPlayerBadge = options.showPlayerBadge ?? true;
  }

  public mount(): void {
    // Enable custom cursor mode on body
    document.body.classList.add('oui-custom-cursor');

    this.cursorElement = document.createElement('div');
    this.cursorElement.className = 'oui-hand-cursor';

    // Authentic Wii Glove Hand SVG
    this.cursorElement.innerHTML = `
      <svg class="oui-hand-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Glove Shadow Base -->
        <path d="M28 20 C28 15, 36 15, 36 20 L36 44 L45 42 C50 41, 53 45, 52 50 L49 60 L62 55 C67 53, 71 58, 69 63 L60 76 L71 73 C76 72, 79 77, 76 82 L65 94 C57 101, 38 99, 29 90 L16 75 C10 68, 14 58, 22 60 L28 62 Z" fill="#000000" opacity="0.18" transform="translate(3, 4)" />
        
        <!-- Glove Body Outline -->
        <path d="M26 18 C26 11, 35 11, 35 18 L35 44 L44 42 C49 41, 53 45, 52 50 L49 60 L62 55 C67 53, 71 58, 69 63 L60 76 L71 73 C76 72, 79 77, 76 82 L65 94 C57 101, 38 99, 29 90 L16 75 C10 68, 14 58, 22 60 L26 62 Z" fill="#1e293b" />
        
        <!-- Glove Fill (White/Silver Gradient) -->
        <path d="M28 20 C28 15, 33 15, 33 20 L33 46 C33 48, 35 49, 37 48 L44 45 C47 44, 50 47, 49 50 L47 62 C47 64, 49 65, 51 64 L62 58 C65 57, 68 60, 67 63 L58 78 C57 80, 59 82, 61 81 L71 76 C74 75, 77 79, 74 82 L64 92 C58 98, 40 96, 32 88 L19 73 C15 68, 18 61, 24 62 L28 63 Z" fill="url(#gloveGrad)" />

        <!-- Glove Seam & Cuff Details -->
        <path d="M28 84 C34 90, 48 91, 58 87" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="31" cy="23" r="2.5" fill="#e2e8f0" />

        <defs>
          <linearGradient id="gloveGrad" x1="20" y1="15" x2="65" y2="95" gradientUnits="userSpaceOnUse">
            <stop stop-color="#ffffff" />
            <stop offset="0.75" stop-color="#f8fafc" />
            <stop offset="1" stop-color="#e2e8f0" />
          </linearGradient>
        </defs>
      </svg>
      ${this.showPlayerBadge ? '<div class="oui-player-badge">P1</div>' : ''}
    `;

    this.container.appendChild(this.cursorElement);

    // Event hooks
    this.unsubPressA = this.inputManager.on('pressA', () => this.handlePressA());
    this.unsubReleaseA = this.inputManager.on('releaseA', () => this.handleReleaseA());

    // Main animation loop
    this.startLoop();
  }

  private handlePressA(): void {
    if (this.cursorElement) {
      this.cursorElement.classList.add('clicking');
      this.spawnRipple();
    }
  }

  private handleReleaseA(): void {
    if (this.cursorElement) {
      this.cursorElement.classList.remove('clicking');
    }
  }

  private spawnRipple(): void {
    if (!this.cursorElement) return;
    const ripple = document.createElement('div');
    ripple.className = 'oui-cursor-ripple';
    this.cursorElement.appendChild(ripple);
    setTimeout(() => ripple.remove(), 400);
  }

  private startLoop(): void {
    const loop = () => {
      this.updateCursor();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private updateCursor(): void {
    if (!this.cursorElement) return;

    const state = this.inputManager.getState();
    const w = window.innerWidth;
    const h = window.innerHeight;

    const screenX = state.pointer.x * w;
    const screenY = state.pointer.y * h;

    // Roll angle: ±35 degrees based on tilt.roll
    const rotationDeg = state.tilt.roll * 35;

    this.cursorElement.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) rotate(${rotationDeg}deg)`;

    // Detect if hovering an interactive element
    const el = document.elementFromPoint(screenX, screenY);
    const isInteractive = Boolean(
      el && (
        el.tagName === 'BUTTON' ||
        el.closest('button') ||
        el.closest('.oui-channel-tile') ||
        el.closest('.oui-pill-btn') ||
        el.hasAttribute('data-channel-id') ||
        el.getAttribute('role') === 'button'
      )
    );

    if (isInteractive !== this.isHovering) {
      this.isHovering = isInteractive;
      if (this.isHovering) {
        this.cursorElement.classList.add('hovering');
      } else {
        this.cursorElement.classList.remove('hovering');
      }
    }
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.unsubPressA) {
      this.unsubPressA();
      this.unsubPressA = undefined;
    }
    if (this.unsubReleaseA) {
      this.unsubReleaseA();
      this.unsubReleaseA = undefined;
    }

    document.body.classList.remove('oui-custom-cursor');
    this.cursorElement?.remove();
    this.cursorElement = null;
  }
}
