import './calibration.css';
import { RelayClient } from '../input/network/RelayClient';
import { SensorBar } from '../input/sensorbar/SensorBar';
import { PIXEL_ICONS } from '../shared/pixelIcons';

export interface CalibrationModalOptions {
  container: HTMLElement;
  relayClient: RelayClient;
  sensorBar: SensorBar;
  onClose?: () => void;
}

export class CalibrationModal {
  private container: HTMLElement;
  private relayClient: RelayClient;
  private sensorBar: SensorBar;
  private onClose?: () => void;

  private backdropElement: HTMLElement | null = null;
  private targetRing: HTMLElement | null = null;
  private coordsBadge: HTMLElement | null = null;
  private sensitivitySlider: HTMLInputElement | null = null;
  private sensitivityValText: HTMLElement | null = null;

  private isOpen = false;
  private unsubscribeSensorData?: () => void;
  private unsubscribeButtonEvent?: () => void;
  private unsubscribeRecenter?: () => void;

  constructor(options: CalibrationModalOptions) {
    this.container = options.container;
    this.relayClient = options.relayClient;
    this.sensorBar = options.sensorBar;
    this.onClose = options.onClose;

    this.mount();
    this.setupListeners();
  }

  public mount(): void {
    this.backdropElement = document.createElement('div');
    this.backdropElement.className = 'oui-calib-backdrop';

    this.backdropElement.innerHTML = `
      <div class="oui-calib-modal" role="dialog" aria-modal="true" aria-labelledby="oui-calib-title">
        <div class="oui-calib-header">
          <div class="oui-calib-title-group">
            <span class="oui-calib-icon">${PIXEL_ICONS.wiiRemote}</span>
            <h2 id="oui-calib-title" class="oui-calib-title">Sensor Bar Calibration</h2>
          </div>
          <button class="oui-calib-close-btn" id="oui-calib-close-btn" aria-label="Close">&times;</button>
        </div>

        <div class="oui-calib-body">
          <div class="oui-calib-instruction-banner" id="oui-calib-banner">
            Aim your phone at the center crosshair and press <strong>A</strong> on your remote to set the center!
          </div>

          <div class="oui-calib-preview-container" id="oui-calib-preview">
            <div class="oui-calib-crosshair-x"></div>
            <div class="oui-calib-crosshair-y"></div>
            <div class="oui-calib-target-ring" id="oui-calib-target">
              <div class="oui-calib-target-dot"></div>
            </div>
            <div class="oui-calib-preview-badge" id="oui-calib-badge">
              Pointer: (0.500, 0.500)
            </div>
          </div>

          <div class="oui-calib-controls">
            <div class="oui-calib-slider-row">
              <span class="oui-calib-slider-label">Pointer Sensitivity</span>
              <input type="range" class="oui-calib-slider" id="oui-calib-slider" min="0.4" max="2.5" step="0.05" value="1.0">
              <span class="oui-calib-slider-val" id="oui-calib-slider-val">1.00x</span>
            </div>
          </div>

          <div class="oui-calib-actions-row">
            <button class="oui-calib-btn-recenter" id="oui-calib-recenter-btn">
              <span>🎯</span> Set Center (A)
            </button>
            <button class="oui-calib-btn-done" id="oui-calib-done-btn">
              Done & Save
            </button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.backdropElement);

    // Grab element references
    this.targetRing = this.backdropElement.querySelector('#oui-calib-target');
    this.coordsBadge = this.backdropElement.querySelector('#oui-calib-badge');
    this.sensitivitySlider = this.backdropElement.querySelector('#oui-calib-slider') as HTMLInputElement;
    this.sensitivityValText = this.backdropElement.querySelector('#oui-calib-slider-val');

    const closeBtn = this.backdropElement.querySelector('#oui-calib-close-btn');
    const doneBtn = this.backdropElement.querySelector('#oui-calib-done-btn');
    const recenterBtn = this.backdropElement.querySelector('#oui-calib-recenter-btn');

    closeBtn?.addEventListener('click', () => this.close());
    doneBtn?.addEventListener('click', () => this.close());
    recenterBtn?.addEventListener('click', () => this.handleRecenter());

    this.sensitivitySlider?.addEventListener('input', () => {
      if (this.sensitivitySlider) {
        const val = parseFloat(this.sensitivitySlider.value);
        this.sensorBar.setSensitivity(val);
        if (this.sensitivityValText) {
          this.sensitivityValText.textContent = `${val.toFixed(2)}x`;
        }
      }
    });

    this.backdropElement.addEventListener('click', (e) => {
      if (e.target === this.backdropElement) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  private setupListeners(): void {
    // 1. Process continuous sensor stream
    this.unsubscribeSensorData = this.relayClient.onSensorData((remoteId, packet) => {
      if (remoteId === 1) {
        const state = this.sensorBar.update(packet);

        if (this.isOpen) {
          if (this.coordsBadge) {
            this.coordsBadge.textContent = `Pointer: (${state.pointer.x.toFixed(3)}, ${state.pointer.y.toFixed(3)}) • Yaw: ${state.filteredAngles.yaw.toFixed(0)}° Pitch: ${state.filteredAngles.pitch.toFixed(0)}°`;
          }
        }
      }
    });

    // 2. Pressing Button A on the phone sets center
    this.unsubscribeButtonEvent = this.relayClient.onButtonEvent((remoteId, event) => {
      if (remoteId === 1 && event.button === 'A' && event.state === 'down') {
        if (this.isOpen) {
          this.handleRecenter();
        }
      }
    });

    // 3. Recenter packet from remote
    this.unsubscribeRecenter = this.relayClient.onRecenter((remoteId) => {
      if (remoteId === 1) {
        this.handleRecenter();
      }
    });
  }

  public handleRecenter(): void {
    this.sensorBar.recenter();

    // Visual feedback in calibration preview
    if (this.targetRing) {
      this.targetRing.style.transform = 'translate(-50%, -50%) scale(1.35)';
      this.targetRing.style.borderColor = '#db2777';
      this.targetRing.style.background = 'rgba(244, 114, 182, 0.4)';
      setTimeout(() => {
        if (this.targetRing) {
          this.targetRing.style.transform = 'translate(-50%, -50%) scale(1)';
          this.targetRing.style.borderColor = '#f472b6';
          this.targetRing.style.background = 'rgba(254, 242, 248, 0.6)';
        }
      }, 350);
    }

    // Send rumble acknowledgment back to remote
    this.relayClient.sendRumble(1, { duration: 100 });
  }

  public open(): void {
    if (!this.backdropElement) return;
    this.isOpen = true;
    this.backdropElement.classList.add('open');

    // Sync slider with current sensitivity
    if (this.sensitivitySlider && this.sensitivityValText) {
      const cur = this.sensorBar.getSensitivity();
      this.sensitivitySlider.value = cur.toFixed(2);
      this.sensitivityValText.textContent = `${cur.toFixed(2)}x`;
    }
  }

  public close(): void {
    if (!this.backdropElement) return;
    this.isOpen = false;
    this.backdropElement.classList.remove('open');
    this.onClose?.();
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public destroy(): void {
    this.unsubscribeSensorData?.();
    this.unsubscribeButtonEvent?.();
    this.unsubscribeRecenter?.();
    if (this.backdropElement && this.backdropElement.parentNode) {
      this.backdropElement.parentNode.removeChild(this.backdropElement);
    }
  }
}
