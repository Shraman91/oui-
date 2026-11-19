import { InputManager } from '../input/InputManager';
import { MouseProvider } from '../input/providers/MouseProvider';
import { PhoneProvider } from '../input/providers/PhoneProvider';
import { Cursor } from '../input/Cursor';
import { RelayClient } from '../input/network/RelayClient';
import { SensorBar } from '../input/sensorbar/SensorBar';
import { PairingModal } from '../menu/PairingModal';
import { CalibrationModal } from '../menu/CalibrationModal';
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
  private phoneProvider: PhoneProvider;
  private cursor: Cursor;
  private relayClient: RelayClient;
  private sensorBar: SensorBar;
  private pairingModal: PairingModal;
  private calibrationModal: CalibrationModal;
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

    // 3. Initialize SensorBar & Relay Client
    this.sensorBar = new SensorBar();
    this.relayClient = new RelayClient({ autoConnect: true });

    // 4. Initialize Phone Provider & Auto-Switch
    this.phoneProvider = new PhoneProvider(this.inputManager, this.sensorBar, this.relayClient);
    this.inputManager.registerProvider(this.phoneProvider);

    // Auto-switch to Phone when remote connects, and fall back to Mouse when disconnected
    this.relayClient.onRemoteConnected((remoteId) => {
      if (remoteId === 1) {
        this.inputManager.setActiveProvider('phone');
        this.menu?.updateProviderBadge();
        console.log('[oui] Remote 1 connected -> Active controller switched to Phone');
      }
    });

    this.relayClient.onRemoteDisconnected((remoteId) => {
      if (remoteId === 1) {
        this.inputManager.setActiveProvider('mouse');
        this.menu?.updateProviderBadge();
        console.log('[oui] Remote 1 disconnected -> Controller fell back to Mouse');
      }
    });

    // 5. Initialize Modals
    this.calibrationModal = new CalibrationModal({
      container: this.appElement,
      relayClient: this.relayClient,
      sensorBar: this.sensorBar
    });

    this.pairingModal = new PairingModal({
      container: this.appElement,
      relayClient: this.relayClient,
      onOpenCalibration: () => this.calibrationModal.open()
    });

    // Auto-open Calibration screen on first remote connection
    let firstConnectionDone = false;
    this.relayClient.onRemoteConnected(() => {
      if (!firstConnectionDone) {
        firstConnectionDone = true;
        this.pairingModal.close();
        setTimeout(() => {
          this.calibrationModal.open();
        }, 300);
      }
    });

    // 5. Initialize Settings & Telemetry Overlay (Tab key / Wii Options button)
    this.settingsOverlay = new SettingsOverlay({
      container: this.appElement,
      inputManager: this.inputManager,
      onProviderChange: () => {
        this.menu?.updateProviderBadge();
      },
      onOpenPairing: () => this.pairingModal.open(),
      onOpenCalibration: () => this.calibrationModal.open()
    });

    // 6. Initialize Scene Manager
    this.sceneManager = new SceneManager({
      container: this.appElement,
      inputManager: this.inputManager,
      onReturnToMenu: () => this.showMenu()
    });

    // 7. Play Boot Splash before showing menu
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
