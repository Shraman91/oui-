import './fruitninja.css';
import * as Phaser from 'phaser';
import { Game } from '../../core/Game';
import { InputManager } from '../../input/InputManager';
import { FruitNinjaScene } from './FruitNinjaScene';
import { FRUIT_NINJA_CONSTANTS } from './constants';

export class FruitNinjaGame implements Game {
  public readonly id = 'fruitninja';
  public readonly title = 'Fruit Ninja';

  private container: HTMLElement | null = null;
  private inputManager: InputManager | null = null;
  private phaserGame: Phaser.Game | null = null;
  private scene: FruitNinjaScene | null = null;
  private rootElement: HTMLElement | null = null;

  public init(container: HTMLElement, inputManager: InputManager): void {
    this.container = container;
    this.inputManager = inputManager;

    this.rootElement = document.createElement('div');
    this.rootElement.className = 'oui-fruitninja-wrapper';

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'oui-fruitninja-canvas-container';
    this.rootElement.appendChild(canvasContainer);
    this.container.appendChild(this.rootElement);

    this.scene = new FruitNinjaScene();
    this.scene.setInputManager(this.inputManager);

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: canvasContainer,
      width: FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH,
      height: FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT,
      backgroundColor: '#fdf2f8',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [this.scene]
    };

    this.phaserGame = new Phaser.Game(config);
  }

  public update(_dt: number): void {
    // Phaser 3 runs its own internal RAF loop and invokes scene.update
  }

  public pause(): void {
    this.scene?.pauseGame();
    this.phaserGame?.scene.pause('FruitNinjaScene');
  }

  public resume(): void {
    this.scene?.resumeGame();
    this.phaserGame?.scene.resume('FruitNinjaScene');
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
