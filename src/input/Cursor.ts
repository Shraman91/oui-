import './cursor.css';
import { InputManager } from './InputManager';
import { PIXEL_ICONS } from '../shared/pixelIcons';

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
    document.body.classList.add('oui-custom-cursor');

    this.cursorElement = document.createElement('div');
    this.cursorElement.className = 'oui-hand-cursor';

    this.cursorElement.innerHTML = `
      <div class="oui-pixel-hand-svg">
        ${PIXEL_ICONS.pixelHand}
      </div>
      ${this.showPlayerBadge ? '<div class="oui-player-badge">P1</div>' : ''}
    `;

    this.container.appendChild(this.cursorElement);

    this.unsubPressA = this.inputManager.on('pressA', () => this.handlePressA());
    this.unsubReleaseA = this.inputManager.on('releaseA', () => this.handleReleaseA());

    this.startLoop();
  }

  private handlePressA(): void {
    if (this.cursorElement) {
      this.cursorElement.classList.add('clicking');
      this.spawnSparks();
    }
  }

  private handleReleaseA(): void {
    if (this.cursorElement) {
      this.cursorElement.classList.remove('clicking');
    }
  }

  private spawnSparks(): void {
    if (!this.cursorElement) return;

    // Spawn 4 cute pixel sparks popping out diagonally
    const offsets = [
      { dx: '-10px', dy: '-10px' },
      { dx: '10px', dy: '-10px' },
      { dx: '-10px', dy: '10px' },
      { dx: '10px', dy: '10px' }
    ];

    for (const offset of offsets) {
      const spark = document.createElement('div');
      spark.className = 'oui-pixel-spark';
      spark.style.top = '6px';
      spark.style.left = '6px';
      spark.style.setProperty('--dx', offset.dx);
      spark.style.setProperty('--dy', offset.dy);
      this.cursorElement.appendChild(spark);
      setTimeout(() => spark.remove(), 260);
    }
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
