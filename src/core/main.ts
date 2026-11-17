import { InputManager } from '../input/InputManager';
import { MouseProvider } from '../input/providers/MouseProvider';
import { Cursor } from '../input/Cursor';
import { SceneManager } from './SceneManager';
import { Menu, CHANNELS } from '../menu/Menu';
import { BootSplash } from '../menu/BootSplash';
import { SettingsOverlay } from '../menu/SettingsOverlay';
import { PlaceholderGame } from '../games/placeholder/PlaceholderGame';

class OuiConsoleApp {
  private appElement: HTMLElement;
  private inputManager: InputManager;
  private mouseProvider: MouseProvider;
  private cursor: Cursor;
  private sceneManager: SceneManager;
  private settingsOverlay: SettingsOverlay;
  private menu: Menu | null = null;

  constructor() {
    const root = document.getElementById('app');
    if (!root) {
      throw new Error('Root #app element not found');
    }
    this.appElement = root;

    // 1. Initialize Input Subsystem
    this.inputManager = new InputManager();
    this.mouseProvider = new MouseProvider(this.inputManager, this.appElement);
    this.inputManager.registerProvider(this.mouseProvider);

    // 2. Initialize Wii Hand Cursor
    this.cursor = new Cursor({
      inputManager: this.inputManager,
      container: this.appElement,
      showPlayerBadge: true
    });
    this.cursor.mount();

    // 3. Initialize Settings & Telemetry Overlay (Tab key / Wii Options button)
    this.settingsOverlay = new SettingsOverlay({
      container: this.appElement,
      inputManager: this.inputManager,
      onProviderChange: () => {
        this.menu?.updateProviderBadge();
      }
    });

    // 4. Initialize Scene Manager
    this.sceneManager = new SceneManager({
      container: this.appElement,
      inputManager: this.inputManager,
      onReturnToMenu: () => this.showMenu()
    });

    // 5. Play Boot Splash before showing menu
    this.playBootSplash();
  }

  private playBootSplash(): void {
    const splash = new BootSplash({
      container: this.appElement,
      inputManager: this.inputManager,
      durationMs: 1500, // < 2 seconds requirement
      onComplete: () => {
        this.showMenu();
      }
    });
    splash.show();
  }

  private showMenu(): void {
    if (this.menu) {
      this.menu.destroy();
    }

    this.menu = new Menu({
      container: this.sceneManager.getSceneContainer(),
      inputManager: this.inputManager,
      onSelectChannel: (channelId: string) => this.handleChannelSelect(channelId),
      onOpenSettings: () => this.settingsOverlay.open()
    });

    this.menu.mount();
  }

  private handleChannelSelect(channelId: string): void {
    const channel = CHANNELS.find((c) => c.id === channelId);
    const title = channel ? channel.title : 'Channel';

    // Unmount menu
    if (this.menu) {
      this.menu.destroy();
      this.menu = null;
    }

    // Launch Game
    const game = new PlaceholderGame(channelId, title);
    void this.sceneManager.loadGame(game);
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new OuiConsoleApp();
});
