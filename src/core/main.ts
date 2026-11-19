import { InputManager } from '../input/InputManager';
import { MouseProvider } from '../input/providers/MouseProvider';
import { Cursor } from '../input/Cursor';
import { RelayClient } from '../input/network/RelayClient';
import { PairingModal } from '../menu/PairingModal';
import { SceneManager } from './SceneManager';
import { Menu, CHANNELS } from '../menu/Menu';
import { BootSplash } from '../menu/BootSplash';
import { SettingsOverlay } from '../menu/SettingsOverlay';
import { SketchboardGame } from '../games/sketchboard/SketchboardGame';
import { FruitNinjaGame } from '../games/fruitninja/FruitNinjaGame';
import { SpaceFighterGame } from '../games/spacefighter/SpaceFighterGame';
import { TableTennisGame } from '../games/tabletennis/TableTennisGame';
import { PlaceholderGame } from '../games/placeholder/PlaceholderGame';

class OuiConsoleApp {
  private appElement: HTMLElement;
  private inputManager: InputManager;
  private mouseProvider: MouseProvider;
  private cursor: Cursor;
  private relayClient: RelayClient;
  private pairingModal: PairingModal;
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

    // 3. Initialize Relay Client & Pairing Modal
    this.relayClient = new RelayClient({ autoConnect: true });
    this.pairingModal = new PairingModal({
      container: this.appElement,
      relayClient: this.relayClient
    });

    // 4. Initialize Settings & Telemetry Overlay (Tab key / Wii Options button)
    this.settingsOverlay = new SettingsOverlay({
      container: this.appElement,
      inputManager: this.inputManager,
      onProviderChange: () => {
        this.menu?.updateProviderBadge();
      },
      onOpenPairing: () => this.pairingModal.open()
    });

    // 5. Initialize Scene Manager
    this.sceneManager = new SceneManager({
      container: this.appElement,
      inputManager: this.inputManager,
      onReturnToMenu: () => this.showMenu()
    });

    // 6. Play Boot Splash before showing menu
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
      onOpenSettings: () => this.settingsOverlay.open(),
      onOpenPairing: () => this.pairingModal.open()
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
    if (channelId === 'sketchboard') {
      const game = new SketchboardGame();
      void this.sceneManager.loadGame(game);
    } else if (channelId === 'fruitninja') {
      const game = new FruitNinjaGame();
      void this.sceneManager.loadGame(game);
    } else if (channelId === 'spacefighter') {
      const game = new SpaceFighterGame();
      void this.sceneManager.loadGame(game);
    } else if (channelId === 'tabletennis') {
      const game = new TableTennisGame();
      void this.sceneManager.loadGame(game);
    } else {
      const game = new PlaceholderGame(channelId, title);
      void this.sceneManager.loadGame(game);
    }
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new OuiConsoleApp();
});
