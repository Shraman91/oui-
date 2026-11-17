import './splash.css';
import { InputManager } from '../input/InputManager';

export interface BootSplashOptions {
  container: HTMLElement;
  inputManager?: InputManager;
  onComplete: () => void;
  durationMs?: number; // default 1500ms
}

export class BootSplash {
  private container: HTMLElement;
  private inputManager?: InputManager;
  private onComplete: () => void;
  private durationMs: number;

  private rootElement: HTMLElement | null = null;
  private timerId: number | null = null;
  private isFinished = false;
  private unsubPressA?: () => void;

  constructor(options: BootSplashOptions) {
    this.container = options.container;
    this.inputManager = options.inputManager;
    this.onComplete = options.onComplete;
    this.durationMs = options.durationMs ?? 1500;
  }

  public show(): void {
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'oui-splash-container';

    this.rootElement.innerHTML = `
      <div class="oui-splash-box">
        <div class="oui-splash-logo">
          <span>oui</span>
          <svg viewBox="0 0 24 16" class="oui-pixel-eyes-svg" shape-rendering="crispEdges">
            <!-- Left pixel eye ^ (baby pink) -->
            <rect x="2" y="7" width="2" height="3" fill="#ec4899"/>
            <rect x="4" y="4" width="2" height="3" fill="#ec4899"/>
            <rect x="6" y="2" width="2" height="2" fill="#ec4899"/>
            <rect x="8" y="4" width="2" height="3" fill="#ec4899"/>
            <rect x="10" y="7" width="2" height="3" fill="#ec4899"/>

            <!-- Right pixel eye ^ (baby pink) -->
            <rect x="13" y="7" width="2" height="3" fill="#ec4899"/>
            <rect x="15" y="4" width="2" height="3" fill="#ec4899"/>
            <rect x="17" y="2" width="2" height="2" fill="#ec4899"/>
            <rect x="19" y="4" width="2" height="3" fill="#ec4899"/>
            <rect x="21" y="7" width="2" height="3" fill="#ec4899"/>
          </svg>
        </div>
        <div class="oui-splash-badge">Wii Browser Console</div>
      </div>
      <div class="oui-splash-prompt">Press A or Click to Start</div>
    `;

    // Click to skip
    this.rootElement.addEventListener('click', () => {
      this.finish();
    });

    // Button A to skip
    if (this.inputManager) {
      this.unsubPressA = this.inputManager.on('pressA', () => {
        this.finish();
      });
    }

    this.container.appendChild(this.rootElement);

    // Auto complete after duration
    this.timerId = window.setTimeout(() => {
      this.finish();
    }, this.durationMs);
  }

  public finish(): void {
    if (this.isFinished) return;
    this.isFinished = true;

    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (this.unsubPressA) {
      this.unsubPressA();
      this.unsubPressA = undefined;
    }

    if (this.rootElement) {
      this.rootElement.classList.add('fading-out');
      setTimeout(() => {
        this.destroy();
        this.onComplete();
      }, 250);
    } else {
      this.onComplete();
    }
  }

  public destroy(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.unsubPressA) {
      this.unsubPressA();
      this.unsubPressA = undefined;
    }
    this.rootElement?.remove();
    this.rootElement = null;
  }
}
