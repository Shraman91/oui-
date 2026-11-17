import './splash.css';
import { InputManager } from '../input/InputManager';

export interface BootSplashOptions {
  container: HTMLElement;
  inputManager?: InputManager;
  onComplete: () => void;
  durationMs?: number; // default 1500ms (< 2 seconds requirement)
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
      <div class="oui-splash-glow"></div>
      <div class="oui-splash-content">
        <div class="oui-splash-logo">
          oui<span class="oui-splash-eyes">^^</span>
        </div>
        <div class="oui-splash-subtitle">Browser Game Console</div>
      </div>
      <div class="oui-splash-prompt">Press A or Click to skip</div>
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
      }, 350);
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
