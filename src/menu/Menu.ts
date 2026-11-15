import './menu.css';
import { InputManager } from '../input/InputManager';

export interface ChannelInfo {
  id: string;
  title: string;
  icon: string;
  description: string;
  techTag: string;
}

export const CHANNELS: readonly ChannelInfo[] = [
  {
    id: 'sketchboard',
    title: 'Sketchboard',
    icon: '🎨',
    description: 'Freehand canvas drawing & color picker',
    techTag: 'Canvas'
  },
  {
    id: 'fruitninja',
    title: 'Fruit Ninja',
    icon: '🍉',
    description: 'Blade slicing, juicy combos & bombs',
    techTag: 'Phaser 3'
  },
  {
    id: 'spacefighter',
    title: 'Space Fighter',
    icon: '🚀',
    description: 'Tilt steering, alien waves & boss fights',
    techTag: 'Phaser 3'
  },
  {
    id: 'tabletennis',
    title: 'Table Tennis',
    icon: '🏓',
    description: '3D motion physics & paddle swing',
    techTag: 'Three.js'
  }
];

export interface MenuOptions {
  container: HTMLElement;
  inputManager: InputManager;
  onSelectChannel: (channelId: string) => void;
}

export class Menu {
  private container: HTMLElement;
  private inputManager: InputManager;
  private onSelectChannel: (channelId: string) => void;

  private rootElement: HTMLElement | null = null;
  private clockInterval: number | null = null;
  private unsubscribePressA: (() => void) | null = null;

  private tileElements: Map<string, HTMLElement> = new Map();
  private hoveredChannelId: string | null = null;

  constructor(options: MenuOptions) {
    this.container = options.container;
    this.inputManager = options.inputManager;
    this.onSelectChannel = options.onSelectChannel;
  }

  public mount(): void {
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'oui-menu-wrapper';

    // Header
    const header = document.createElement('header');
    header.className = 'oui-menu-header';
    header.innerHTML = `
      <div class="oui-logo-title">
        oui<span class="eyes">^^</span>
      </div>
      <div class="oui-header-status">
        <div class="oui-provider-badge">
          <span class="oui-provider-dot"></span>
          <span id="oui-active-provider-name">Mouse & Keyboard</span>
        </div>
      </div>
    `;

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
        <span class="oui-channel-tag">${channel.techTag}</span>
        <div class="oui-channel-icon">${channel.icon}</div>
        <h3 class="oui-channel-title">${channel.title}</h3>
        <p class="oui-channel-desc">${channel.description}</p>
      `;

      tile.addEventListener('click', () => {
        this.selectChannel(channel.id);
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

    // Footer
    const footer = document.createElement('footer');
    footer.className = 'oui-menu-footer';
    footer.innerHTML = `
      <div class="oui-footer-instructions">Press [Tab] for Input HUD &bull; Click or Press A to launch</div>
      <div class="oui-clock" id="oui-menu-clock">--:--</div>
    `;

    this.rootElement.appendChild(header);
    this.rootElement.appendChild(gridContainer);
    this.rootElement.appendChild(footer);

    this.container.appendChild(this.rootElement);

    this.startClock();

    // Listen for Button A press
    this.unsubscribePressA = this.inputManager.on('pressA', () => {
      if (this.hoveredChannelId) {
        this.selectChannel(this.hoveredChannelId);
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

  private selectChannel(channelId: string): void {
    const tile = this.tileElements.get(channelId);
    if (tile) {
      tile.classList.add('pressed');
      setTimeout(() => {
        tile.classList.remove('pressed');
        this.onSelectChannel(channelId);
      }, 150);
    } else {
      this.onSelectChannel(channelId);
    }
  }

  private startClock(): void {
    const updateTime = () => {
      if (!this.rootElement) return;
      const clockEl = this.rootElement.querySelector('#oui-menu-clock');
      if (!clockEl) return;
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const day = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      clockEl.textContent = `${day}  ${hours}:${minutes}`;
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
