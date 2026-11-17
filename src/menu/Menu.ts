import './menu.css';
import { InputManager } from '../input/InputManager';

export interface ChannelInfo {
  id: string;
  title: string;
  icon: string;
  description: string;
  techTag: string;
  screenClass: string;
}

export const CHANNELS: readonly ChannelInfo[] = [
  {
    id: 'sketchboard',
    title: 'Sketchboard',
    icon: '🎨',
    description: 'Freehand canvas drawing & color picker',
    techTag: 'Canvas',
    screenClass: 'oui-screen-sketchboard'
  },
  {
    id: 'fruitninja',
    title: 'Fruit Ninja',
    icon: '🍉',
    description: 'Blade slicing, juicy combos & bombs',
    techTag: 'Phaser 3',
    screenClass: 'oui-screen-fruitninja'
  },
  {
    id: 'spacefighter',
    title: 'Space Fighter',
    icon: '🚀',
    description: 'Tilt steering, alien waves & boss fights',
    techTag: 'Phaser 3',
    screenClass: 'oui-screen-spacefighter'
  },
  {
    id: 'tabletennis',
    title: 'Table Tennis',
    icon: '🏓',
    description: '3D motion physics & paddle swing',
    techTag: 'Three.js',
    screenClass: 'oui-screen-tabletennis'
  }
];

export interface MenuOptions {
  container: HTMLElement;
  inputManager: InputManager;
  onSelectChannel: (channelId: string, tileEl?: HTMLElement) => void;
  onOpenSettings?: () => void;
}

export class Menu {
  private container: HTMLElement;
  private inputManager: InputManager;
  private onSelectChannel: (channelId: string, tileEl?: HTMLElement) => void;
  private onOpenSettings?: () => void;

  private rootElement: HTMLElement | null = null;
  private clockInterval: number | null = null;
  private unsubscribePressA: (() => void) | null = null;

  private tileElements: Map<string, HTMLElement> = new Map();
  private hoveredChannelId: string | null = null;
  private isLaunching = false;

  constructor(options: MenuOptions) {
    this.container = options.container;
    this.inputManager = options.inputManager;
    this.onSelectChannel = options.onSelectChannel;
    this.onOpenSettings = options.onOpenSettings;
  }

  public mount(): void {
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'oui-menu-wrapper oui-menu-entering';

    // Header
    const header = document.createElement('header');
    header.className = 'oui-menu-header';
    header.innerHTML = `
      <div class="oui-logo-title">
        oui<span class="eyes">^^</span>
      </div>
      <div class="oui-header-status">
        <div class="oui-provider-badge" id="oui-header-provider-badge" title="Click or Press Tab for Settings">
          <span class="oui-provider-dot"></span>
          <span id="oui-active-provider-name">Mouse & Keyboard</span>
        </div>
      </div>
    `;

    const badge = header.querySelector('#oui-header-provider-badge');
    badge?.addEventListener('click', () => {
      this.onOpenSettings?.();
    });

    // 2x2 Grid
    const gridContainer = document.createElement('main');
    gridContainer.className = 'oui-grid-container';

    const grid = document.createElement('div');
    grid.className = 'oui-channel-grid';

    for (const channel of CHANNELS) {
      const tile = document.createElement('div');
      tile.className = 'oui-channel-tile';
      tile.dataset.channelId = channel.id;
      tile.tabIndex = 0;

      tile.innerHTML = `
        <div class="oui-channel-screen ${channel.screenClass}">
          <span class="oui-channel-tag">${channel.techTag}</span>
          <div class="oui-channel-icon">${channel.icon}</div>
        </div>
        <div class="oui-channel-info-strip">
          <h3 class="oui-channel-title">${channel.title}</h3>
          <p class="oui-channel-desc">${channel.description}</p>
        </div>
      `;

      tile.addEventListener('click', () => {
        this.selectChannel(channel.id, tile);
      });

      tile.addEventListener('mouseenter', () => {
        this.hoveredChannelId = channel.id;
        tile.classList.add('hovered');
      });

      tile.addEventListener('mouseleave', () => {
        if (this.hoveredChannelId === channel.id) {
          this.hoveredChannelId = null;
        }
        tile.classList.remove('hovered');
      });

      this.tileElements.set(channel.id, tile);
      grid.appendChild(tile);
    }

    gridContainer.appendChild(grid);

    // Wii Bottom Bar
    const footer = document.createElement('footer');
    footer.className = 'oui-menu-footer';
    footer.innerHTML = `
      <button class="oui-pill-btn" id="oui-btn-wii-options" title="Wii Settings (Tab)">
        <span>⚙️</span> Wii Options
      </button>
      <div class="oui-footer-center">
        <div class="oui-clock" id="oui-menu-clock">--:--</div>
        <div class="oui-date" id="oui-menu-date">--- --</div>
      </div>
      <button class="oui-pill-btn" id="oui-btn-wii-msg" title="Console Info">
        <span>✉️</span> Info
      </button>
    `;

    const optionsBtn = footer.querySelector('#oui-btn-wii-options');
    optionsBtn?.addEventListener('click', () => {
      this.onOpenSettings?.();
    });

    const msgBtn = footer.querySelector('#oui-btn-wii-msg');
    msgBtn?.addEventListener('click', () => {
      this.onOpenSettings?.();
    });

    this.rootElement.appendChild(header);
    this.rootElement.appendChild(gridContainer);
    this.rootElement.appendChild(footer);

    this.container.appendChild(this.rootElement);

    this.startClock();

    // Listen for Button A press
    this.unsubscribePressA = this.inputManager.on('pressA', () => {
      if (this.hoveredChannelId && !this.isLaunching) {
        const tile = this.tileElements.get(this.hoveredChannelId);
        this.selectChannel(this.hoveredChannelId, tile);
      }
    });

    this.updateProviderBadge();
  }

  public updateProviderBadge(): void {
    if (!this.rootElement) return;
    const nameEl = this.rootElement.querySelector('#oui-active-provider-name');
    const provider = this.inputManager.getActiveProvider();
    if (nameEl && provider) {
      nameEl.textContent = provider.name;
    }
  }

  private selectChannel(channelId: string, tile?: HTMLElement): void {
    if (this.isLaunching) return;
    this.isLaunching = true;

    if (tile) {
      tile.classList.add('launching');
    }

    if (this.rootElement) {
      this.rootElement.classList.add('oui-menu-launching');
    }

    // Smooth Wii channel zoom delay before mounting game scene
    setTimeout(() => {
      this.onSelectChannel(channelId, tile);
    }, 380);
  }

  private startClock(): void {
    const updateTime = () => {
      if (!this.rootElement) return;
      const clockEl = this.rootElement.querySelector('#oui-menu-clock');
      const dateEl = this.rootElement.querySelector('#oui-menu-date');
      if (!clockEl) return;

      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      clockEl.textContent = `${hours}:${minutes}`;

      if (dateEl) {
        const dayName = now.toLocaleDateString(undefined, { weekday: 'short' });
        const dateStr = now.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
        dateEl.textContent = `${dayName} ${dateStr}`;
      }
    };

    updateTime();
    this.clockInterval = window.setInterval(updateTime, 1000);
  }

  public destroy(): void {
    if (this.clockInterval !== null) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
    if (this.unsubscribePressA) {
      this.unsubscribePressA();
      this.unsubscribePressA = null;
    }
    this.tileElements.clear();
    this.rootElement?.remove();
    this.rootElement = null;
  }
}
