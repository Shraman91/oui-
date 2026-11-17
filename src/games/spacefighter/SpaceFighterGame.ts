import './spacefighter.css';
import * as Phaser from 'phaser';
import { Game } from '../../core/Game';
import { InputManager } from '../../input/InputManager';
import { SpaceFighterScene } from './SpaceFighterScene';
import { SPACE_FIGHTER_CONSTANTS } from './constants';

export class SpaceFighterGame implements Game {
  public readonly id = 'spacefighter';
  public readonly title = 'Space Fighter';

  private container: HTMLElement | null = null;
  private inputManager: InputManager | null = null;
  private phaserGame: Phaser.Game | null = null;
  private scene: SpaceFighterScene | null = null;
  private rootElement: HTMLElement | null = null;

  public init(container: HTMLElement, inputManager: InputManager): void {
    this.container = container;
    this.inputManager = inputManager;

    this.rootElement = document.createElement('div');
    this.rootElement.className = 'oui-spacefighter-wrapper';

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'oui-spacefighter-canvas-container';
    this.rootElement.appendChild(canvasContainer);
    this.container.appendChild(this.rootElement);

    this.scene = new SpaceFighterScene();
    this.scene.setInputManager(this.inputManager);

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: canvasContainer,
      width: SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH,
      height: SPACE_FIGHTER_CONSTANTS.CANVAS.HEIGHT,
      backgroundColor: '#181124',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [this.scene]
    };

    this.phaserGame = new Phaser.Game(config);
  }

  public update(_dt: number): void {
    // Phaser drives its own internal requestAnimationFrame loop
  }

  public pause(): void {
    this.scene?.pauseGame();
    this.phaserGame?.scene.pause('SpaceFighterScene');
  }

  public resume(): void {
    this.scene?.resumeGame();
    this.phaserGame?.scene.resume('SpaceFighterScene');
  }

  public destroy(): void {
    this.scene?.cleanup();

    if (this.phaserGame) {
      this.phaserGame.destroy(true);
      this.phaserGame = null;
    }

    if (this.rootElement && this.rootElement.parentElement) {
      this.rootElement.parentElement.removeChild(this.rootElement);
      this.rootElement = null;
    }

    this.scene = null;
    this.container = null;
    this.inputManager = null;
  }
}
