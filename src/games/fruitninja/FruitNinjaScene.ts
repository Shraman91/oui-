import * as Phaser from 'phaser';
import { FRUIT_NINJA_CONSTANTS, FruitConfig } from './constants';
import { FruitTextureGenerator } from './textures';
import { checkSegmentCircleCollision, Point } from './collision';
import { BladeTrail } from './BladeTrail';
import { InputManager } from '../../input/InputManager';
import { StorageManager } from '../../shared/storage';

interface ActiveFruit {
  id: string;
  type: 'fruit' | 'bomb';
  config?: FruitConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  radius: number;
  sprite: Phaser.GameObjects.Sprite;
  sliced: boolean;
}

interface SplitHalf {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
}

interface JuiceParticle {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  lifetime: number;
  maxLifetime: number;
}

export class FruitNinjaScene extends Phaser.Scene {
  private inputManager!: InputManager;

  // Game state
  private score = 0;
  private highScore = 0;
  private misses = 0;
  private isGameOver = false;
  private isGamePaused = false;

  private spawnTimer = 0;
  private currentSpawnInterval: number = FRUIT_NINJA_CONSTANTS.GAMEPLAY.SPAWN_INTERVAL_INITIAL;

  // Combo tracking
  private comboCount = 0;
  private comboTimer = 0;

  // Active entities
  private activeFruits: ActiveFruit[] = [];
  private splitHalves: SplitHalf[] = [];
  private particles: JuiceParticle[] = [];

  // Blade Trail
  private bladeTrail!: BladeTrail;
  private lastPointer: Point | null = null;
  private unsubPressA?: () => void;

  // UI GameObjects
  private scoreText!: Phaser.GameObjects.Text;
  private highScoreText!: Phaser.GameObjects.Text;
  private missIcons: Phaser.GameObjects.Text[] = [];
  private gameOverContainer?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'FruitNinjaScene' });
  }

  public init(data?: { inputManager?: InputManager }): void {
    if (data?.inputManager) {
      this.inputManager = data.inputManager;
    }
  }

  public setInputManager(inputManager: InputManager): void {
    this.inputManager = inputManager;
  }

  public create(): void {
    // 1. Generate programmatic retro textures
    FruitTextureGenerator.generateAll(this);

    // 2. High score from StorageManager
    this.highScore = StorageManager.getHighScore('fruitninja');

    // 3. Background: Cute solid mint/pastel dojo (Zero gradients)
    const bg = this.add.rectangle(
      FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH / 2,
      FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT / 2,
      FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH,
      FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT,
      0xfdf2f8 // Baby pink backdrop
    );
    bg.setDepth(-10);

    // Inner play mat (Soft pastel mint bamboo floor)
    const floor = this.add.rectangle(
      FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH / 2,
      FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT / 2,
      FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH - 48,
      FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT - 48,
      0xdcfce7 // Mint green play mat
    );
    floor.setStrokeStyle(3.5, 0x3b1d28);
    floor.setDepth(-9);

    // 4. Initialize Blade Trail
    this.bladeTrail = new BladeTrail(this);

    // 5. Build Retro HUD
    this.createHUD();

    // 6. Reset state
    this.resetGame();

    // 7. Subscribe to Button A to restart when game over
    if (this.inputManager) {
      this.unsubPressA = this.inputManager.on('pressA', () => {
        if (this.isGameOver) {
          this.resetGame();
        }
      });
    }
  }

  private createHUD(): void {
    const W = FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH;

    // Score HUD Box (Top Left)
    const scoreBox = this.add.rectangle(130, 52, 180, 52, 0xffffff);
    scoreBox.setStrokeStyle(3, 0x3b1d28);
    scoreBox.setDepth(200);

    this.scoreText = this.add.text(130, 52, 'SCORE: 0', {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '20px',
      color: '#3b1d28',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(201);

    // High Score Box (Top Center)
    const hsBox = this.add.rectangle(W / 2, 52, 220, 44, 0xfce7f3);
    hsBox.setStrokeStyle(2.5, 0x3b1d28);
    hsBox.setDepth(200);

    this.highScoreText = this.add.text(W / 2, 52, `BEST: ${this.highScore}`, {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#db2777',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(201);

    // Misses Box (Top Right)
    const missBox = this.add.rectangle(W - 130, 52, 180, 52, 0xffffff);
    missBox.setStrokeStyle(3, 0x3b1d28);
    missBox.setDepth(200);

    this.missIcons = [];
    const startX = W - 180;
    for (let i = 0; i < FRUIT_NINJA_CONSTANTS.GAMEPLAY.MAX_MISSES; i++) {
      const icon = this.add.text(startX + i * 50, 52, '♥', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f472b6',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(201);
      this.missIcons.push(icon);
    }
  }

  private resetGame(): void {
    this.score = 0;
    this.misses = 0;
    this.isGameOver = false;
    this.isGamePaused = false;
    this.spawnTimer = 0;
    this.currentSpawnInterval = FRUIT_NINJA_CONSTANTS.GAMEPLAY.SPAWN_INTERVAL_INITIAL;
    this.comboCount = 0;
    this.comboTimer = 0;

    // Clear active fruits and halves
    for (const f of this.activeFruits) {
      f.sprite.destroy();
    }
    this.activeFruits = [];

    for (const h of this.splitHalves) {
      h.sprite.destroy();
    }
    this.splitHalves = [];

    for (const p of this.particles) {
      p.sprite.destroy();
    }
    this.particles = [];

    this.updateHUD();
    this.gameOverContainer?.destroy();
    this.gameOverContainer = undefined;
  }

  public update(time: number, delta: number): void {
    if (this.isGamePaused || !this.inputManager) return;

    const dt = Math.max(0.001, Math.min(delta / 1000, 0.1));
    const currentTime = time / 1000;

    // 1. Read Pointer from InputManager
    const state = this.inputManager.getState();
    let px = state.pointer.x * FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH;
    let py = state.pointer.y * FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT;

    const canvas = this.game.canvas;
    if (canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
      const rect = canvas.getBoundingClientRect();
      const screenX = state.pointer.x * window.innerWidth;
      const screenY = state.pointer.y * window.innerHeight;
      px = ((screenX - rect.left) / rect.width) * FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH;
      py = ((screenY - rect.top) / rect.height) * FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT;
    }

    // 2. Update Blade Trail
    this.bladeTrail.addPoint(px, py, currentTime);
    this.bladeTrail.update(currentTime);

    const currentPointer = { x: px, y: py };

    if (!this.isGameOver) {
      // 3. Slicing Detection (requires movement threshold so hovering doesn't cut)
      if (this.lastPointer) {
        const moveDist = Math.hypot(
          currentPointer.x - this.lastPointer.x,
          currentPointer.y - this.lastPointer.y
        );
        if (moveDist >= 4) {
          this.detectSlices(this.lastPointer, currentPointer, currentTime);
        }
      }

      // 4. Update Combos
      if (this.comboCount > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.evaluateCombo();
        }
      }

      // 5. Spawn Waves
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.currentSpawnInterval) {
        this.spawnTimer = 0;
        this.spawnWave();
        // Dynamically accelerate spawns
        this.currentSpawnInterval = Math.max(
          FRUIT_NINJA_CONSTANTS.GAMEPLAY.SPAWN_INTERVAL_MIN,
          this.currentSpawnInterval - 0.03
        );
      }

      // 6. Simulate Active Fruits
      this.updateActiveFruits(dt);
    }

    this.lastPointer = currentPointer;

    // 7. Simulate Split Halves & Particles
    this.updateSplitHalves(dt);
    this.updateParticles(dt);
  }

  private detectSlices(p1: Point, p2: Point, _time: number): void {
    for (let i = this.activeFruits.length - 1; i >= 0; i--) {
      const fruit = this.activeFruits[i];
      if (fruit.sliced) continue;

      const hitTest = checkSegmentCircleCollision(p1, p2, {
        x: fruit.x,
        y: fruit.y,
        radius: fruit.radius
      });

      if (hitTest.hit) {
        this.sliceFruit(fruit, hitTest.sliceAngle, hitTest.impactPoint);
      }
    }
  }

  private sliceFruit(fruit: ActiveFruit, sliceAngle: number, impactPoint: Point): void {
    fruit.sliced = true;
    fruit.sprite.setVisible(false);

    if (fruit.type === 'bomb') {
      // Bomb sliced: immediate game over!
      this.triggerBombExplosion(fruit.x, fruit.y);
      this.triggerGameOver('BOMB DETONATED!');
      return;
    }

    // Fruit sliced: Split into halves
    if (fruit.config) {
      this.createSplitHalves(fruit, sliceAngle);
      this.createJuiceSplatter(impactPoint.x, impactPoint.y, fruit.config);

      // Increment combo count
      this.comboCount++;
      this.comboTimer = FRUIT_NINJA_CONSTANTS.GAMEPLAY.COMBO_WINDOW_SECONDS;

      // Base score
      const pts = fruit.config.points;
      this.score += pts;
      this.showScorePopup(fruit.x, fruit.y, `+${pts}`, fruit.config.juiceColor);

      this.updateHUD();
    }
  }

  private createSplitHalves(fruit: ActiveFruit, sliceAngle: number): void {
    if (!fruit.config) return;

    // Outward impulse perpendicular to slice cut
    const outwardAngle = sliceAngle + Math.PI / 2;
    const outwardSpeed = FRUIT_NINJA_CONSTANTS.PHYSICS.SPLIT_OUTWARD_SPEED;

    const ox = Math.cos(outwardAngle) * outwardSpeed;
    const oy = Math.sin(outwardAngle) * outwardSpeed;

    // Left Half
    const leftSprite = this.add.sprite(fruit.x, fruit.y, `fruit_${fruit.config.id}_half_left`);
    leftSprite.setRotation(sliceAngle);
    leftSprite.setDepth(15);
    this.splitHalves.push({
      sprite: leftSprite,
      x: fruit.x,
      y: fruit.y,
      vx: fruit.vx - ox,
      vy: fruit.vy - oy,
      rotation: sliceAngle,
      rotationSpeed: -3.0
    });

    // Right Half
    const rightSprite = this.add.sprite(fruit.x, fruit.y, `fruit_${fruit.config.id}_half_right`);
    rightSprite.setRotation(sliceAngle);
    rightSprite.setDepth(15);
    this.splitHalves.push({
      sprite: rightSprite,
      x: fruit.x,
      y: fruit.y,
      vx: fruit.vx + ox,
      vy: fruit.vy + oy,
      rotation: sliceAngle,
      rotationSpeed: 3.0
    });
  }

  private createJuiceSplatter(x: number, y: number, fruit: FruitConfig): void {
    const count = 14;
    const juiceTint = parseInt(fruit.juiceColor.replace('#', ''), 16);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 260;

      const pSprite = this.add.sprite(x, y, `particle_${Math.floor(Math.random() * 5)}`);
      pSprite.setTint(juiceTint);
      pSprite.setScale(0.8 + Math.random() * 0.6);
      pSprite.setDepth(25);

      this.particles.push({
        sprite: pSprite,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        lifetime: 0,
        maxLifetime: 0.35 + Math.random() * 0.25
      });
    }
  }

  private triggerBombExplosion(x: number, y: number): void {
    // Camera shake
    this.cameras.main.shake(300, 0.02);

    // Explosion flash
    this.cameras.main.flash(250, 255, 255, 255);

    // Dark explosion sparks
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 180 + Math.random() * 400;

      const pSprite = this.add.sprite(x, y, 'particle_0');
      pSprite.setScale(1.2);
      pSprite.setDepth(50);

      this.particles.push({
        sprite: pSprite,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        lifetime: 0,
        maxLifetime: 0.5
      });
    }
  }

  private evaluateCombo(): void {
    if (this.comboCount >= 2) {
      const bonus = this.comboCount;
      this.score += bonus;
      this.showScorePopup(
        FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH / 2,
        FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT / 2 - 80,
        `COMBO x${this.comboCount}! +${bonus}`,
        '#ec4899',
        30
      );
      this.updateHUD();
    }
    this.comboCount = 0;
  }

  private spawnWave(): void {
    const waveSize = 1 + Math.floor(Math.random() * 3); // 1 to 3 items
    const spawnBomb = Math.random() < FRUIT_NINJA_CONSTANTS.GAMEPLAY.BOMB_SPAWN_CHANCE;

    for (let i = 0; i < waveSize; i++) {
      // Delay wave items slightly
      this.time.delayedCall(i * 120, () => {
        if (this.isGameOver || this.isGamePaused) return;

        if (i === 0 && spawnBomb) {
          this.spawnItem('bomb');
        } else {
          const randomFruit = FRUIT_NINJA_CONSTANTS.FRUITS[
            Math.floor(Math.random() * FRUIT_NINJA_CONSTANTS.FRUITS.length)
          ];
          this.spawnItem('fruit', randomFruit);
        }
      });
    }
  }

  private spawnItem(type: 'fruit' | 'bomb', config?: FruitConfig): void {
    const W = FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH;
    const H = FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT;

    const x = W * 0.18 + Math.random() * (W * 0.64);
    const y = H + 30;

    const vy = Phaser.Math.Between(
      FRUIT_NINJA_CONSTANTS.PHYSICS.MIN_LAUNCH_VY,
      FRUIT_NINJA_CONSTANTS.PHYSICS.MAX_LAUNCH_VY
    );

    // Inward horizontal velocity towards center
    const targetCenterX = W / 2;
    const directionToCenter = x < targetCenterX ? 1 : -1;
    const vx = directionToCenter * (60 + Math.random() * 140);

    const rotSpeed = Phaser.Math.FloatBetween(
      FRUIT_NINJA_CONSTANTS.PHYSICS.ROTATION_SPEED_MIN,
      FRUIT_NINJA_CONSTANTS.PHYSICS.ROTATION_SPEED_MAX
    );

    const textureKey = type === 'bomb' ? 'bomb' : `fruit_${config!.id}_whole`;
    const sprite = this.add.sprite(x, y, textureKey);
    sprite.setDepth(10);

    this.activeFruits.push({
      id: Phaser.Utils.String.UUID(),
      type,
      config,
      x,
      y,
      vx,
      vy,
      rotation: 0,
      rotationSpeed: rotSpeed,
      radius: type === 'bomb' ? FRUIT_NINJA_CONSTANTS.BOMB.radius : config!.radius,
      sprite,
      sliced: false
    });
  }

  private updateActiveFruits(dt: number): void {
    const H = FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT;
    const gravity = FRUIT_NINJA_CONSTANTS.PHYSICS.GRAVITY;

    for (let i = this.activeFruits.length - 1; i >= 0; i--) {
      const f = this.activeFruits[i];

      f.vy += gravity * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rotation += f.rotationSpeed * dt;

      f.sprite.setPosition(f.x, f.y);
      f.sprite.setRotation(f.rotation);

      // Dropped past bottom
      if (f.y > H + 50 && f.vy > 0) {
        if (!f.sliced && f.type === 'fruit') {
          // Player missed a fruit!
          this.handleMiss(f.x);
        }

        f.sprite.destroy();
        this.activeFruits.splice(i, 1);
      }
    }
  }

  private handleMiss(x: number): void {
    this.misses++;
    this.updateHUD();

    // Show visual red X on bottom where fruit dropped
    const cross = this.add.text(x, FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT - 40, '✕', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#dc2626',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(150);

    this.tweens.add({
      targets: cross,
      alpha: 0,
      y: cross.y - 30,
      duration: 600,
      onComplete: () => cross.destroy()
    });

    if (this.misses >= FRUIT_NINJA_CONSTANTS.GAMEPLAY.MAX_MISSES) {
      this.triggerGameOver('3 MISSES - GAME OVER');
    }
  }

  private updateSplitHalves(dt: number): void {
    const H = FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT;
    const gravity = FRUIT_NINJA_CONSTANTS.PHYSICS.GRAVITY;

    for (let i = this.splitHalves.length - 1; i >= 0; i--) {
      const h = this.splitHalves[i];

      h.vy += gravity * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rotation += h.rotationSpeed * dt;

      h.sprite.setPosition(h.x, h.y);
      h.sprite.setRotation(h.rotation);

      if (h.y > H + 70) {
        h.sprite.destroy();
        this.splitHalves.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.lifetime += dt;

      p.vy += 450 * dt; // light gravity on juice
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const progress = p.lifetime / p.maxLifetime;
      p.alpha = Math.max(0, 1 - progress);
      p.sprite.setPosition(p.x, p.y);
      p.sprite.setAlpha(p.alpha);

      if (p.lifetime >= p.maxLifetime) {
        p.sprite.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  private showScorePopup(x: number, y: number, text: string, color: string, size = 22): void {
    const popup = this.add.text(x, y, text, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: `${size}px`,
      color,
      fontStyle: 'bold',
      stroke: '#3b1d28',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(150);

    this.tweens.add({
      targets: popup,
      y: y - 50,
      scale: 1.25,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => popup.destroy()
    });
  }

  private updateHUD(): void {
    this.scoreText.setText(`SCORE: ${this.score}`);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      StorageManager.saveHighScore('fruitninja', this.highScore);
    }
    this.highScoreText.setText(`BEST: ${this.highScore}`);

    // Update hearts / misses
    for (let i = 0; i < this.missIcons.length; i++) {
      if (i < this.misses) {
        this.missIcons[i].setText('✕');
        this.missIcons[i].setColor('#dc2626');
      } else {
        this.missIcons[i].setText('♥');
        this.missIcons[i].setColor('#f472b6');
      }
    }
  }

  private triggerGameOver(reason: string): void {
    this.isGameOver = true;

    // Check high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      StorageManager.saveHighScore('fruitninja', this.highScore);
    }

    const W = FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH;
    const H = FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT;

    // Game Over Retro Card (Baby-pink flat aesthetic)
    this.gameOverContainer = this.add.container(W / 2, H / 2).setDepth(300);

    const card = this.add.rectangle(0, 0, 440, 320, 0xffffff);
    card.setStrokeStyle(3.5, 0x3b1d28);

    const cardShadow = this.add.rectangle(8, 8, 440, 320, 0xf472b6);
    cardShadow.setDepth(-1);

    const title = this.add.text(0, -95, reason, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '24px',
      color: '#db2777',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const finalScore = this.add.text(0, -35, `FINAL SCORE: ${this.score}`, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '28px',
      color: '#3b1d28',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const bestScore = this.add.text(0, 15, `ALL TIME BEST: ${this.highScore}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#0284c7',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Play Again Button
    const restartBtnBg = this.add.rectangle(0, 80, 220, 48, 0xec4899);
    restartBtnBg.setStrokeStyle(2.5, 0x3b1d28);
    restartBtnBg.setInteractive({ useHandCursor: true });

    const restartBtnText = this.add.text(0, 80, 'PLAY AGAIN', {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    restartBtnBg.on('pointerdown', () => {
      this.resetGame();
    });

    this.gameOverContainer.add([cardShadow, card, title, finalScore, bestScore, restartBtnBg, restartBtnText]);
  }

  public pauseGame(): void {
    this.isGamePaused = true;
  }

  public resumeGame(): void {
    this.isGamePaused = false;
  }

  public restartGame(): void {
    this.resetGame();
  }

  public cleanup(): void {
    this.unsubPressA?.();
    this.unsubPressA = undefined;

    this.bladeTrail?.destroy();
    for (const f of this.activeFruits) {
      f.sprite.destroy();
    }
    this.activeFruits = [];

    for (const h of this.splitHalves) {
      h.sprite.destroy();
    }
    this.splitHalves = [];

    for (const p of this.particles) {
      p.sprite.destroy();
    }
    this.particles = [];

    this.gameOverContainer?.destroy();
  }
}
