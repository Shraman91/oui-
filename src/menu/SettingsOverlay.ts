import './settings.css';
import { InputManager } from '../input/InputManager';
import { PIXEL_ICONS } from '../shared/pixelIcons';

export interface SettingsOverlayOptions {
  container: HTMLElement;
  inputManager: InputManager;
  onProviderChange?: (providerId: string) => void;
  onOpenPairing?: () => void;
  onOpenCalibration?: () => void;
}

export class SettingsOverlay {
  private container: HTMLElement;
  private inputManager: InputManager;
  private onProviderChange?: (providerId: string) => void;
  private onOpenPairing?: () => void;
  private onOpenCalibration?: () => void;

  private backdropElement: HTMLElement | null = null;
  private isOpen = false;
  private rafId: number | null = null;
  private lastSwingInfo = 'None';

  constructor(options: SettingsOverlayOptions) {
    this.container = options.container;
    this.inputManager = options.inputManager;
    this.onProviderChange = options.onProviderChange;
    this.onOpenPairing = options.onOpenPairing;
    this.onOpenCalibration = options.onOpenCalibration;

    this.inputManager.on('swing', (payload) => {
      this.lastSwingInfo = `${payload.speed.toFixed(1)} u/s (${payload.direction.x.toFixed(2)}, ${payload.direction.y.toFixed(2)})`;
    });

    this.mount();
  }

  public mount(): void {
    this.backdropElement = document.createElement('div');
    this.backdropElement.className = 'oui-settings-backdrop';

    this.renderContent();
    this.container.appendChild(this.backdropElement);

    // Close on backdrop click
    this.backdropElement.addEventListener('click', (e) => {
      if (e.target === this.backdropElement) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  private renderContent(): void {
    if (!this.backdropElement) return;

    const activeProvider = this.inputManager.getActiveProvider();
    const providers = this.inputManager.getProviders();

    this.backdropElement.innerHTML = `
      <div class="oui-settings-modal">
        <div class="oui-settings-header">
          <div class="oui-settings-title">
            <span style="display:inline-flex; align-items:center;">${PIXEL_ICONS.gear}</span>
            <span>Console Settings</span>
          </div>
          <button class="oui-settings-close-btn" id="oui-settings-close-btn">&times;</button>
        </div>

        <div class="oui-settings-body">
          <div>
            <div class="oui-settings-section-title">[ Input Providers ]</div>
            <div class="oui-provider-list" id="oui-provider-list">
              ${providers.map((p) => `
                <div class="oui-provider-item ${p.id === activeProvider?.id ? 'active' : ''}" data-provider-id="${p.id}">
                  <div class="oui-provider-info">
                    <span class="oui-provider-item-name">${p.name}</span>
                    <span class="oui-provider-item-desc">${this.getProviderDescription(p.id)}</span>
                  </div>
                  ${p.id === activeProvider?.id ? '<span class="oui-provider-active-badge">Active</span>' : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <div>
            <div class="oui-settings-section-title">[ Wii Remote & Phone Pairing ]</div>
            <div style="margin-top: 0.6rem; display: flex; flex-direction: column; gap: 8px;">
              <button class="oui-pill-btn" id="oui-settings-open-pairing-btn" style="width: 100%; padding: 0.75rem 1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                <span class="oui-btn-icon">${PIXEL_ICONS.wiiRemote}</span> Pair Phone as Wii Remote (QR Code)
              </button>
              <button class="oui-pill-btn" id="oui-settings-open-calib-btn" style="width: 100%; padding: 0.75rem 1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; background: #fdf2f8;">
                <span class="oui-btn-icon">🎯</span> Sensor Bar Calibration Screen
              </button>
            </div>
          </div>

          <div>
            <div class="oui-settings-section-title">[ Controller Telemetry ]</div>
            <div class="oui-telemetry-grid">
              <div class="oui-telemetry-item">
                <span class="oui-telemetry-label">Pointer Coordinates</span>
                <span class="oui-telemetry-value" id="oui-tel-ptr">(0.000, 0.000)</span>
              </div>
              <div class="oui-telemetry-item">
                <span class="oui-telemetry-label">Pointer Velocity</span>
                <span class="oui-telemetry-value" id="oui-tel-vel">(0.00, 0.00)</span>
              </div>
              <div class="oui-telemetry-item">
                <span class="oui-telemetry-label">Tilt (Roll / Pitch)</span>
                <span class="oui-telemetry-value" id="oui-tel-tilt">R: 0.00 | P: 0.00</span>
              </div>
              <div class="oui-telemetry-item">
                <span class="oui-telemetry-label">Last Swing Impulse</span>
                <span class="oui-telemetry-value" id="oui-tel-swing">${this.lastSwingInfo}</span>
              </div>
              <div class="oui-telemetry-buttons">
                <div class="oui-btn-pill-indicator" id="oui-tel-btn-a">BUTTON A</div>
                <div class="oui-btn-pill-indicator" id="oui-tel-btn-b">BUTTON B</div>
              </div>
            </div>
          </div>
        </div>

        <div class="oui-settings-footer">
          <button class="oui-settings-done-btn" id="oui-settings-done-btn">Done</button>
        </div>
      </div>
    `;

    const closeBtn = this.backdropElement.querySelector('#oui-settings-close-btn');
    const doneBtn = this.backdropElement.querySelector('#oui-settings-done-btn');
    closeBtn?.addEventListener('click', () => this.close());
    doneBtn?.addEventListener('click', () => this.close());

    const pairBtn = this.backdropElement.querySelector('#oui-settings-open-pairing-btn');
    pairBtn?.addEventListener('click', () => {
      this.close();
      this.onOpenPairing?.();
    });

    const calibBtn = this.backdropElement.querySelector('#oui-settings-open-calib-btn');
    calibBtn?.addEventListener('click', () => {
      this.close();
      this.onOpenCalibration?.();
    });

    const items = this.backdropElement.querySelectorAll('.oui-provider-item');
    for (const item of items) {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-provider-id');
        if (id) {
          this.inputManager.setActiveProvider(id);
          this.renderContent();
          this.onProviderChange?.(id);
        }
      });
    }
  }

  private getProviderDescription(id: string): string {
    switch (id) {
      case 'mouse':
        return 'Mouse pointer, Left Click (A), Right Click (B), WASD/Arrows tilt, Flick swing.';
      case 'hand':
        return 'Webcam MediaPipe fingertip tracking, pinch click, hand flick swing.';
      case 'phone':
        return 'Phone motion sensor over WebSocket with tilt & accelerometer.';
      default:
        return 'Motion & button controller.';
    }
  }

  public open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.renderContent();
    this.backdropElement?.classList.add('open');
    this.startTelemetryLoop();
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.backdropElement?.classList.remove('open');
    this.stopTelemetryLoop();
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private startTelemetryLoop(): void {
    const loop = () => {
      if (!this.isOpen) return;
      this.updateTelemetry();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopTelemetryLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private updateTelemetry(): void {
    if (!this.backdropElement) return;

    const state = this.inputManager.getState();

    const ptrEl = this.backdropElement.querySelector('#oui-tel-ptr');
    const velEl = this.backdropElement.querySelector('#oui-tel-vel');
    const tiltEl = this.backdropElement.querySelector('#oui-tel-tilt');
    const swingEl = this.backdropElement.querySelector('#oui-tel-swing');
    const btnAEl = this.backdropElement.querySelector('#oui-tel-btn-a');
    const btnBEl = this.backdropElement.querySelector('#oui-tel-btn-b');

    if (ptrEl) ptrEl.textContent = `(${state.pointer.x.toFixed(3)}, ${state.pointer.y.toFixed(3)})`;
    if (velEl) velEl.textContent = `(${state.pointerVelocity.x.toFixed(2)}, ${state.pointerVelocity.y.toFixed(2)})`;
    if (tiltEl) tiltEl.textContent = `R: ${state.tilt.roll.toFixed(2)} | P: ${state.tilt.pitch.toFixed(2)}`;
    if (swingEl) swingEl.textContent = this.lastSwingInfo;

    if (btnAEl) {
      if (state.buttonA) {
        btnAEl.classList.add('active-a');
      } else {
        btnAEl.classList.remove('active-a');
      }
    }

    if (btnBEl) {
      if (state.buttonB) {
        btnBEl.classList.add('active-b');
      } else {
        btnBEl.classList.remove('active-b');
      }
    }
  }

  public destroy(): void {
    this.stopTelemetryLoop();
    this.backdropElement?.remove();
    this.backdropElement = null;
  }
}
