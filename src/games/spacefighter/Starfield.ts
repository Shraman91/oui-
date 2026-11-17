import * as Phaser from 'phaser';
import { SPACE_FIGHTER_CONSTANTS } from './constants';

interface Star {
  sprite: Phaser.GameObjects.Sprite;
  speed: number;
}

export class Starfield {
  private stars: Star[] = [];
  private width: number;
  private height: number;

  constructor(scene: Phaser.Scene) {
    this.width = SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH;
    this.height = SPACE_FIGHTER_CONSTANTS.CANVAS.HEIGHT;

    // Layer 1: Distant stardust
    for (let i = 0; i < SPACE_FIGHTER_CONSTANTS.STARFIELD.LAYER_1_COUNT; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const sprite = scene.add.sprite(x, y, 'star_small');
      sprite.setDepth(-50);
      sprite.setAlpha(0.4 + Math.random() * 0.4);
      this.stars.push({
        sprite,
        speed: SPACE_FIGHTER_CONSTANTS.STARFIELD.LAYER_1_SPEED * (0.8 + Math.random() * 0.4)
      });
    }

    // Layer 2: Mid-distance stars
    for (let i = 0; i < SPACE_FIGHTER_CONSTANTS.STARFIELD.LAYER_2_COUNT; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const sprite = scene.add.sprite(x, y, 'star_medium');
      sprite.setDepth(-45);
      sprite.setAlpha(0.6 + Math.random() * 0.4);
      this.stars.push({
        sprite,
        speed: SPACE_FIGHTER_CONSTANTS.STARFIELD.LAYER_2_SPEED * (0.85 + Math.random() * 0.3)
      });
    }

    // Layer 3: Foreground twinkling stars
    for (let i = 0; i < SPACE_FIGHTER_CONSTANTS.STARFIELD.LAYER_3_COUNT; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const sprite = scene.add.sprite(x, y, 'star_large');
      sprite.setDepth(-40);
      this.stars.push({
        sprite,
        speed: SPACE_FIGHTER_CONSTANTS.STARFIELD.LAYER_3_SPEED * (0.9 + Math.random() * 0.2)
      });
    }
  }

  public update(dt: number): void {
    for (const star of this.stars) {
      star.sprite.y += star.speed * dt;

      if (star.sprite.y > this.height + 10) {
        star.sprite.y = -10;
        star.sprite.x = Math.random() * this.width;
      }
    }
  }

  public destroy(): void {
    for (const star of this.stars) {
      star.sprite.destroy();
    }
    this.stars = [];
  }
}
