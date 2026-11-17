import { Game } from './Game';
import { InputManager } from '../input/InputManager';
import '../menu/transitions.css';

export interface SceneManagerOptions {
  container: HTMLElement;
  inputManager: InputManager;
  onReturnToMenu?: () => void;
}

export class SceneManager {
  private container: HTMLElement;
  private inputManager: InputManager;
  private activeGame: Game | null = null;
  private isPaused = false;
  private isRunning = false;
  private lastTime = 0;
  private rafId: number | null = null;

  private sceneContainer: HTMLElement;
  private pauseOverlay: HTMLElement;
  private flashOverlay: HTMLElement;
  private onReturnToMenuCallback?: () => void;

  private onKeyDownBound: (e: KeyboardEvent) => void;

  constructor(options: SceneManagerOptions) {
    this.container = options.container;
    this.inputManager = options.inputManager;
    this.onReturnToMenuCallback = options.onReturnToMenu;

    // Build scene container
    this.sceneContainer = document.createElement('div');
    this.sceneContainer.className = 'oui-scene-container';
    this.sceneContainer.style.width = '100%';
    this.sceneContainer.style.height = '100%';
    this.sceneContainer.style.position = 'relative';
    this.container.appendChild(this.sceneContainer);

    // Build white transition flash overlay
    this.flashOverlay = document.createElement('div');
    this.flashOverlay.className = 'oui-transition-flash';
    this.container.appendChild(this.flashOverlay);

    // Build pause overlay
    this.pauseOverlay = document.createElement('div');
    this.pauseOverlay.className = 'oui-pause-overlay';
    this.setupPauseOverlay();
    this.container.appendChild(this.pauseOverlay);

    this.onKeyDownBound = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDownBound);

    this.startLoop();
  }

  public setOnReturnToMenu(callback: () => void): void {
    this.onReturnToMenuCallback = callback;
  }

  public getActiveGame(): Game | null {
    return this.activeGame;
  }

  public getSceneContainer(): HTMLElement {
    return this.sceneContainer;
  }

  /**
   * Loads a game instance, mounts it into the container, and initiates its lifecycle with Wii zoom transition.
   */
  public async loadGame(game: Game): Promise<void> {
    if (this.activeGame) {
      this.destroyActiveGame();
    }

    this.isPaused = false;
    this.hidePauseOverlay();

    // Trigger brief white flash for authentic Wii Channel launch
    this.triggerFlash();

    this.activeGame = game;
    this.sceneContainer.innerHTML = '';

    // Add in-game pause button (accessible via pointer)
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'oui-ingame-pause-btn';
    pauseBtn.innerHTML = `
      <span style="display:inline-flex; width:12px; height:12px; justify-content:space-between;">
        <span style="width:3px; height:12px; background-color:#1e293b;"></span>
        <span style="width:3px; height:12px; background-color:#1e293b;"></span>
      </span>
    `;
    pauseBtn.title = 'Pause (Esc)';
    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePause();
    });
    this.sceneContainer.appendChild(pauseBtn);

    const gameContainer = document.createElement('div');
    gameContainer.className = 'oui-game-viewport';
    gameContainer.style.width = '100%';
    gameContainer.style.height = '100%';
    this.sceneContainer.appendChild(gameContainer);

    await game.init(gameContainer, this.inputManager);
  }

  /**
   * Tears down active game with smooth exit animation and returns to the menu shell.
   */
  public returnToMenu(): void {
    this.hidePauseOverlay();
    this.isPaused = false;

    const currentViewport = this.sceneContainer.querySelector('.oui-game-viewport');
    if (currentViewport) {
      currentViewport.classList.add('oui-game-exiting');
      setTimeout(() => {
        this.destroyActiveGame();
        if (this.onReturnToMenuCallback) {
          this.onReturnToMenuCallback();
        }
      }, 260);
    } else {
      this.destroyActiveGame();
      if (this.onReturnToMenuCallback) {
        this.onReturnToMenuCallback();
      }
    }
  }

  public restartActiveGame(): void {
    if (!this.activeGame) return;
    const currentGame = this.activeGame;
    this.destroyActiveGame();
    void this.loadGame(currentGame);
  }

  public togglePause(): void {
    if (!this.activeGame) return;

    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.activeGame.pause?.();
      this.showPauseOverlay();
    } else {
      this.hidePauseOverlay();
      this.activeGame.resume?.();
    }
  }

  private triggerFlash(): void {
    this.flashOverlay.classList.add('active');
    setTimeout(() => {
      this.flashOverlay.classList.remove('active');
    }, 280);
  }

  private destroyActiveGame(): void {
    if (this.activeGame) {
      try {
        this.activeGame.destroy();
      } catch (err) {
        console.error('Error destroying active game:', err);
      }
      this.activeGame = null;
    }
    this.sceneContainer.innerHTML = '';
  }

  private setupPauseOverlay(): void {
    this.pauseOverlay.style.display = 'none';
    this.pauseOverlay.style.position = 'absolute';
    this.pauseOverlay.style.inset = '0';
    this.pauseOverlay.style.backgroundColor = 'rgba(15, 23, 42, 0.65)';
    this.pauseOverlay.style.zIndex = '1000';
    this.pauseOverlay.style.flexDirection = 'column';
    this.pauseOverlay.style.alignItems = 'center';
    this.pauseOverlay.style.justifyContent = 'center';

    this.pauseOverlay.innerHTML = `
      <div class="oui-pause-card" style="
        background-color: #ffffff;
        border-radius: 24px;
        padding: 2.5rem 3.5rem;
        box-shadow: 8px 8px 0px #f472b6;
        border: 3.5px solid #3b1d28;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
        min-width: 320px;
        text-align: center;
      ">
        <h2 style="font-family: 'Comfortaa', cursive, sans-serif; font-size: 2rem; color: #3b1d28; margin: 0;">Game Paused</h2>
        <div style="display: flex; flex-direction: column; gap: 0.85rem; width: 100%;">
          <button id="oui-btn-resume" style="
            background-color: #ec4899;
            color: #ffffff;
            border: 2.5px solid #3b1d28;
            box-shadow: 4px 4px 0px #3b1d28;
            padding: 0.8rem 1.5rem;
            border-radius: 14px;
            font-size: 1.05rem;
            font-weight: 700;
            cursor: pointer;
            font-family: 'Comfortaa', sans-serif;
            transition: transform 0.1s ease;
          ">Resume</button>
          <button id="oui-btn-restart" style="
            background-color: #fdf2f8;
            color: #3b1d28;
            border: 2.5px solid #3b1d28;
            box-shadow: 3.5px 3.5px 0px #f472b6;
            padding: 0.8rem 1.5rem;
            border-radius: 14px;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            font-family: 'Comfortaa', sans-serif;
            transition: transform 0.1s ease;
          ">Restart Game</button>
          <button id="oui-btn-menu" style="
            background-color: #fdf2f8;
            color: #3b1d28;
            border: 2.5px solid #3b1d28;
            box-shadow: 3.5px 3.5px 0px #f472b6;
            padding: 0.8rem 1.5rem;
            border-radius: 14px;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            font-family: 'Comfortaa', sans-serif;
            transition: transform 0.1s ease;
          ">Return to Wii Menu</button>
        </div>
      </div>
    `;

    const resumeBtn = this.pauseOverlay.querySelector('#oui-btn-resume') as HTMLButtonElement;
    const restartBtn = this.pauseOverlay.querySelector('#oui-btn-restart') as HTMLButtonElement;
    const menuBtn = this.pauseOverlay.querySelector('#oui-btn-menu') as HTMLButtonElement;

    resumeBtn.addEventListener('click', () => this.togglePause());
    restartBtn.addEventListener('click', () => this.restartActiveGame());
    menuBtn.addEventListener('click', () => this.returnToMenu());
  }

  private showPauseOverlay(): void {
    this.pauseOverlay.style.display = 'flex';
  }

  private hidePauseOverlay(): void {
    this.pauseOverlay.style.display = 'none';
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.activeGame) {
      this.togglePause();
    }
  }

  private startLoop(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();

    const loop = (time: number) => {
      const rawDt = (time - this.lastTime) / 1000;
      this.lastTime = time;

      // Delta-time clamped between 0.0001 and 0.1s to prevent physics/rendering skips on tab switch
      const dt = Math.max(0.0001, Math.min(rawDt, 0.1));

      // 1. Advance input provider
      this.inputManager.update(dt);

      // 2. Advance active game if running and not paused
      if (this.activeGame && !this.isPaused) {
        this.activeGame.update(dt);
        if (this.activeGame.render) {
          this.activeGame.render();
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  public destroy(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('keydown', this.onKeyDownBound);
    this.destroyActiveGame();
    this.pauseOverlay.remove();
    this.flashOverlay.remove();
    this.sceneContainer.remove();
  }
}
