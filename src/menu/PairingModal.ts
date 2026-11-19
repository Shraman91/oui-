import QRCode from 'qrcode';
import './pairing.css';
import { RelayClient } from '../input/network/RelayClient';
import { PIXEL_ICONS } from '../shared/pixelIcons';

export interface PairingModalOptions {
  container: HTMLElement;
  relayClient: RelayClient;
  onClose?: () => void;
}

export class PairingModal {
  private container: HTMLElement;
  private relayClient: RelayClient;
  private onClose?: () => void;

  private backdropElement: HTMLElement | null = null;
  private qrCanvas: HTMLCanvasElement | null = null;
  private roomCodeElement: HTMLElement | null = null;
  private directUrlElement: HTMLElement | null = null;
  private copyBtn: HTMLButtonElement | null = null;
  private protoBtn: HTMLButtonElement | null = null;
  private remote1Card: HTMLElement | null = null;
  private remote2Card: HTMLElement | null = null;
  private remote1Status: HTMLElement | null = null;
  private remote2Status: HTMLElement | null = null;
  private relayStatusDot: HTMLElement | null = null;
  private relayStatusText: HTMLElement | null = null;

  private isOpen = false;
  private preferHttps = true;
  private unsubscribeRoomCreated?: () => void;
  private unsubscribeRemoteConnected?: () => void;
  private unsubscribeRemoteDisconnected?: () => void;
  private unsubscribeConnChange?: () => void;

  constructor(options: PairingModalOptions) {
    this.container = options.container;
    this.relayClient = options.relayClient;
    this.onClose = options.onClose;

    this.mount();
    this.setupListeners();
  }

  public mount(): void {
    this.backdropElement = document.createElement('div');
    this.backdropElement.className = 'oui-pairing-backdrop';

    this.backdropElement.innerHTML = `
      <div class="oui-pairing-modal" role="dialog" aria-modal="true" aria-labelledby="oui-pairing-modal-title">
        <div class="oui-pairing-header">
          <div class="oui-pairing-title-group">
            <span class="oui-pairing-icon">${PIXEL_ICONS.wiiRemote}</span>
            <h2 id="oui-pairing-modal-title" class="oui-pairing-title">Pair Wii Remote (Phone)</h2>
          </div>
          <button class="oui-pairing-close-btn" id="oui-pairing-close-btn" aria-label="Close">&times;</button>
        </div>

        <div class="oui-pairing-body">
          <div class="oui-pairing-qr-section">
            <div class="oui-pairing-qr-box">
              <canvas id="oui-pairing-qr-canvas" width="160" height="160"></canvas>
            </div>
            <div class="oui-pairing-qr-info">
              <div class="oui-pairing-code-label">Room Code</div>
              <div class="oui-pairing-code-display" id="oui-pairing-code">----</div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="oui-pairing-copy-btn" id="oui-pairing-copy-btn">
                  <span>[Link]</span> Copy URL
                </button>
                <button class="oui-pairing-copy-btn" id="oui-pairing-proto-btn" style="background: #f1f5f9; color: #475569; border-color: #cbd5e1;">
                  Switch to HTTP
                </button>
              </div>
              <div class="oui-pairing-direct-url" id="oui-pairing-url">Generating room...</div>
            </div>
          </div>

          <div class="oui-pairing-remotes-grid">
            <div class="oui-pairing-remote-card" id="oui-remote-card-1">
              <div class="oui-pairing-remote-led" id="oui-remote-led-1"></div>
              <div class="oui-pairing-remote-info">
                <span class="oui-pairing-remote-name">Remote 1 (Player 1)</span>
                <span class="oui-pairing-remote-status" id="oui-remote-status-1">Waiting to join...</span>
              </div>
            </div>

            <div class="oui-pairing-remote-card" id="oui-remote-card-2">
              <div class="oui-pairing-remote-led" id="oui-remote-led-2"></div>
              <div class="oui-pairing-remote-info">
                <span class="oui-pairing-remote-name">Remote 2 (Player 2)</span>
                <span class="oui-pairing-remote-status" id="oui-remote-status-2">Waiting to join...</span>
              </div>
            </div>
          </div>

          <div class="oui-pairing-instructions">
            <div><strong>1. Same Wi-Fi:</strong> Ensure phone is on the same Wi-Fi as this console.</div>
            <div><strong>2. Scan QR:</strong> Open camera app or QR scanner and open the link.</div>
            <div><strong>3. Motion:</strong> Accept motion permissions to swing and aim!</div>
          </div>
        </div>

        <div class="oui-pairing-footer-bar">
          <div class="oui-pairing-relay-status">
            <span class="oui-pairing-relay-dot" id="oui-pairing-relay-dot"></span>
            <span id="oui-pairing-relay-text">Relay Server: Connecting...</span>
          </div>
          <div id="oui-pairing-port-text">Ports: 8080 (WS) & 8443 (WSS)</div>
        </div>
      </div>
    `;

    this.container.appendChild(this.backdropElement);

    // Grab element references
    this.qrCanvas = this.backdropElement.querySelector('#oui-pairing-qr-canvas') as HTMLCanvasElement;
    this.roomCodeElement = this.backdropElement.querySelector('#oui-pairing-code');
    this.directUrlElement = this.backdropElement.querySelector('#oui-pairing-url');
    this.copyBtn = this.backdropElement.querySelector('#oui-pairing-copy-btn') as HTMLButtonElement;
    this.protoBtn = this.backdropElement.querySelector('#oui-pairing-proto-btn') as HTMLButtonElement;
    this.remote1Card = this.backdropElement.querySelector('#oui-remote-card-1');
    this.remote2Card = this.backdropElement.querySelector('#oui-remote-card-2');
    this.remote1Status = this.backdropElement.querySelector('#oui-remote-status-1');
    this.remote2Status = this.backdropElement.querySelector('#oui-remote-status-2');
    this.relayStatusDot = this.backdropElement.querySelector('#oui-pairing-relay-dot');
    this.relayStatusText = this.backdropElement.querySelector('#oui-pairing-relay-text');

    const closeBtn = this.backdropElement.querySelector('#oui-pairing-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    this.backdropElement.addEventListener('click', (e) => {
      if (e.target === this.backdropElement) {
        this.close();
      }
    });

    this.copyBtn?.addEventListener('click', () => {
      const url = this.relayClient.getControllerUrl(this.preferHttps);
      if (url && navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          if (this.copyBtn) {
            const originalText = this.copyBtn.innerHTML;
            this.copyBtn.innerHTML = '<span>✓</span> Copied!';
            setTimeout(() => {
              if (this.copyBtn) this.copyBtn.innerHTML = originalText;
            }, 1800);
          }
        });
      }
    });

    this.protoBtn?.addEventListener('click', () => {
      this.preferHttps = !this.preferHttps;
      const code = this.relayClient.getRoomCode();
      if (code) {
        this.updateRoomDisplay(code);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Update initial view if room is already created
    const existingCode = this.relayClient.getRoomCode();
    if (existingCode) {
      this.updateRoomDisplay(existingCode);
    }
  }

  private setupListeners(): void {
    this.unsubscribeRoomCreated = this.relayClient.onRoomCreated((code) => {
      this.updateRoomDisplay(code);
    });

    this.unsubscribeRemoteConnected = this.relayClient.onRemoteConnected((remoteId) => {
      this.updateRemoteStatus(remoteId, true);
    });

    this.unsubscribeRemoteDisconnected = this.relayClient.onRemoteDisconnected((remoteId) => {
      this.updateRemoteStatus(remoteId, false);
    });

    let p1PacketCount = 0;
    let p1LastHzTime = performance.now();
    let p1Hz = 60;
    let lastTelemetryUpdate1 = 0;
    let lastTelemetryUpdate2 = 0;

    this.relayClient.onSensorData((remoteId, packet) => {
      const now = performance.now();
      if (remoteId === 1) {
        p1PacketCount++;
        if (now - p1LastHzTime >= 1000) {
          p1Hz = Math.round((p1PacketCount * 1000) / (now - p1LastHzTime));
          p1PacketCount = 0;
          p1LastHzTime = now;
        }
        if (now - lastTelemetryUpdate1 > 80 && this.isOpen) {
          lastTelemetryUpdate1 = now;
          if (this.remote1Status && !this.remote1Status.textContent?.includes('Pressed')) {
            this.remote1Status.textContent = `${p1Hz} Hz • α:${packet.orientation.alpha.toFixed(0)}° β:${packet.orientation.beta.toFixed(0)}° γ:${packet.orientation.gamma.toFixed(0)}°`;
            this.remote1Status.style.color = '#0284c7';
          }
        }
      } else if (remoteId === 2) {
        if (now - lastTelemetryUpdate2 > 80 && this.isOpen) {
          lastTelemetryUpdate2 = now;
          if (this.remote2Status && !this.remote2Status.textContent?.includes('Pressed')) {
            this.remote2Status.textContent = `Live • α:${packet.orientation.alpha.toFixed(0)}° β:${packet.orientation.beta.toFixed(0)}° γ:${packet.orientation.gamma.toFixed(0)}°`;
            this.remote2Status.style.color = '#0284c7';
          }
        }
      }
    });

    this.relayClient.onButtonEvent((remoteId, event) => {
      const statusText = remoteId === 1 ? this.remote1Status : this.remote2Status;
      const card = remoteId === 1 ? this.remote1Card : this.remote2Card;
      if (statusText && card) {
        if (event.state === 'down') {
          statusText.textContent = `Button ${event.button} Pressed!`;
          statusText.style.color = '#ec4899';
          card.style.transform = 'scale(1.03)';
          card.style.borderColor = '#ec4899';
        } else {
          statusText.textContent = `Connected (Remote ${remoteId})`;
          statusText.style.color = '#16a34a';
          card.style.transform = 'scale(1)';
          card.style.borderColor = '#86efac';
        }
      }
    });

    this.relayClient.onRecenter((remoteId) => {
      const statusText = remoteId === 1 ? this.remote1Status : this.remote2Status;
      const card = remoteId === 1 ? this.remote1Card : this.remote2Card;
      if (statusText && card) {
        statusText.textContent = 'Recenter Triggered! 🎯';
        statusText.style.color = '#0284c7';
        card.style.borderColor = '#38bdf8';
        setTimeout(() => {
          if (statusText) {
            statusText.textContent = `Connected (Remote ${remoteId})`;
            statusText.style.color = '#16a34a';
          }
          if (card) {
            card.style.borderColor = '#86efac';
          }
        }, 1200);
      }
    });

    this.unsubscribeConnChange = this.relayClient.onConnectionChange((connected) => {
      if (this.relayStatusDot) {
        this.relayStatusDot.className = `oui-pairing-relay-dot ${connected ? 'connected' : 'disconnected'}`;
      }
      if (this.relayStatusText) {
        this.relayStatusText.textContent = connected ? 'Relay Server: Connected' : 'Relay Server: Reconnecting...';
      }
    });
  }

  private updateRoomDisplay(code: string): void {
    if (this.roomCodeElement) {
      this.roomCodeElement.textContent = code;
    }

    const url = this.relayClient.getControllerUrl(this.preferHttps) || '';
    if (this.directUrlElement) {
      this.directUrlElement.textContent = url;
    }

    if (this.protoBtn) {
      this.protoBtn.textContent = this.preferHttps ? 'Switch to HTTP' : 'Switch to HTTPS';
    }

    if (this.qrCanvas && url) {
      QRCode.toCanvas(
        this.qrCanvas,
        url,
        {
          width: 160,
          margin: 1,
          color: {
            dark: '#382c33',
            light: '#ffffff'
          }
        },
        (error) => {
          if (error) {
            console.error('Failed to generate QR code canvas:', error);
          }
        }
      );
    }
  }

  private updateRemoteStatus(remoteId: 1 | 2, connected: boolean): void {
    const card = remoteId === 1 ? this.remote1Card : this.remote2Card;
    const statusText = remoteId === 1 ? this.remote1Status : this.remote2Status;

    if (card) {
      card.classList.toggle('connected', connected);
    }
    if (statusText) {
      statusText.textContent = connected ? `Connected (Remote ${remoteId})` : 'Waiting to join...';
    }
  }

  public open(): void {
    if (!this.backdropElement) return;
    this.isOpen = true;
    this.backdropElement.classList.add('open');

    // If relay client is not connected, try connecting
    if (!this.relayClient.isConnected()) {
      this.relayClient.connect();
    } else {
      const code = this.relayClient.getRoomCode();
      if (code) {
        this.updateRoomDisplay(code);
      }
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
    this.unsubscribeRoomCreated?.();
    this.unsubscribeRemoteConnected?.();
    this.unsubscribeRemoteDisconnected?.();
    this.unsubscribeConnChange?.();
    if (this.backdropElement && this.backdropElement.parentNode) {
      this.backdropElement.parentNode.removeChild(this.backdropElement);
    }
  }
}
