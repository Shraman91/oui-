import { InputManager } from '../input/InputManager';
import { MouseProvider } from '../input/providers/MouseProvider';
import { SceneManager } from './SceneManager';
import { Menu, CHANNELS } from '../menu/Menu';
import { PlaceholderGame } from '../games/placeholder/PlaceholderGame';

class OuiConsoleApp {
  private appElement: HTMLElement;
  private inputManager: InputManager;
  private mouseProvider: MouseProvider;
  private sceneManager: SceneManager;
  private menu: Menu | null = null;
  private debugHud: HTMLElement | null = null;
  private isHudVisible = false;
  private lastSwingInfo = 'None';

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

    // Track swing events for debug overlay
    this.inputManager.on('swing', (payload) => {
      this.lastSwingInfo = `${payload.speed.toFixed(1)} u/s (${payload.direction.x.toFixed(2)}, ${payload.direction.y.toFixed(2)})`;
    });

    // 2. Initialize Scene Manager
    this.sceneManager = new SceneManager({
      container: this.appElement,
      inputManager: this.inputManager,
      onReturnToMenu: () => this.showMenu()
    });

    // 3. Initialize Debug HUD
    this.initDebugHud();

    // 4. Start in Menu
    this.showMenu();
  }

  private showMenu(): void {
    if (this.menu) {
      this.menu.destroy();
    }

    this.menu = new Menu({
      container: this.sceneManager.getSceneContainer(),
      inputManager: this.inputManager,
      onSelectChannel: (channelId: string) => this.handleChannelSelect(channelId)
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

  private initDebugHud(): void {
    this.debugHud = document.createElement('div');
    this.debugHud.className = 'oui-debug-hud';
    this.debugHud.style.display = 'none';

    this.appElement.appendChild(this.debugHud);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        this.toggleHud();
      }
    });

    // Update HUD loop
    const updateHud = () => {
      if (this.isHudVisible && this.debugHud) {
        const state = this.inputManager.getState();
        const provider = this.inputManager.getActiveProvider();
        this.debugHud.innerHTML = `
          <h4>oui^^ Input HUD [Tab]</h4>
          <div><strong>Provider:</strong> ${provider?.name ?? 'None'}</div>
          <div><strong>Pointer:</strong> (${state.pointer.x.toFixed(3)}, ${state.pointer.y.toFixed(3)})</div>
          <div><strong>Velocity:</strong> (${state.pointerVelocity.x.toFixed(2)}, ${state.pointerVelocity.y.toFixed(2)})</div>
          <div><strong>Tilt Roll:</strong> ${state.tilt.roll.toFixed(2)}</div>
          <div><strong>Tilt Pitch:</strong> ${state.tilt.pitch.toFixed(2)}</div>
          <div><strong>Button A:</strong> ${state.buttonA ? '<span style="color:#22c55e">PRESSED</span>' : 'Released'}</div>
          <div><strong>Button B:</strong> ${state.buttonB ? '<span style="color:#38bdf8">PRESSED</span>' : 'Released'}</div>
          <div><strong>Last Swing:</strong> ${this.lastSwingInfo}</div>
        `;
      }
      requestAnimationFrame(updateHud);
    };

    requestAnimationFrame(updateHud);
  }

  private toggleHud(): void {
    if (!this.debugHud) return;
    this.isHudVisible = !this.isHudVisible;
    this.debugHud.style.display = this.isHudVisible ? 'block' : 'none';
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new OuiConsoleApp();
});
