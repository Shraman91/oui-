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
    pauseBtn.innerHTML = '&#10074;&#10074;';
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
    this.pauseOverlay.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
    this.pauseOverlay.style.backdropFilter = 'blur(8px)';
    this.pauseOverlay.style.zIndex = '1000';
    this.pauseOverlay.style.flexDirection = 'column';
    this.pauseOverlay.style.alignItems = 'center';
    this.pauseOverlay.style.justifyContent = 'center';
    this.pauseOverlay.style.gap = '1.25rem';

    this.pauseOverlay.innerHTML = `
      <div class="oui-pause-card" style="
        background: #ffffff;
        border-radius: 28px;
        padding: 2.5rem 3.5rem;
        box-shadow: 0 25px 50px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
        min-width: 340px;
        text-align: center;
        border: 2px solid rgba(255,255,255,0.9);
      ">
        <h2 style="font-family: 'Comfortaa', cursive, sans-serif; font-size: 2.2rem; color: #1e293b; margin: 0;">Paused</h2>
        <div style="display: flex; flex-direction: column; gap: 0.85rem; width: 100%;">
          <button id="oui-btn-resume" style="
            background: #0284c7;
            color: #ffffff;
            border: none;
            padding: 0.9rem 1.6rem;
            border-radius: 9999px;
            font-size: 1.15rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(2,132,199,0.35);
            transition: transform 0.15s, background-color 0.15s;
          ">Resume</button>
          <button id="oui-btn-restart" style="
            background: #f1f5f9;
            color: #334155;
            border: 2px solid #e2e8f0;
            padding: 0.85rem 1.5rem;
            border-radius: 9999px;
            font-size: 1.05rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.15s, background-color 0.15s;
          ">Restart Game</button>
          <button id="oui-btn-menu" style="
            background: #f1f5f9;
            color: #334155;
            border: 2px solid #e2e8f0;
            padding: 0.85rem 1.5rem;
            border-radius: 9999px;
            font-size: 1.05rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.15s, background-color 0.15s;
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
