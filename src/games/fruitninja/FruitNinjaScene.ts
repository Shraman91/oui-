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
  sparkTimer?: number;
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

interface JuiceDroplet {
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
  private particles: JuiceDroplet[] = [];

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
    // 1. Generate programmatic vector textures
    FruitTextureGenerator.generateAll(this);

    // 2. High score from StorageManager
    this.highScore = StorageManager.getHighScore('fruitninja');

    // 3. Gentle, eye-friendly Tatami Dojo aesthetic (Zero Gradients, zero harsh saturated neons)
    const W = FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH;
    const H = FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT;

    // Outer warm cream frame
    const outerBg = this.add.rectangle(W / 2, H / 2, W, H, 0xf8f5f6);
    outerBg.setDepth(-20);

    // Inner soothing sage tatami play mat
    const dojoMat = this.add.rectangle(W / 2, H / 2, W - 44, H - 44, 0xedf7ed);
    dojoMat.setStrokeStyle(2.5, 0x3d3037);
    dojoMat.setDepth(-10);

    // Subtle decorative tatami stitch borders
    const matBorder = this.add.graphics();
    matBorder.setDepth(-9);
    matBorder.lineStyle(1.5, 0xc4e5cb, 0.7);
    matBorder.strokeRect(32, 32, W - 64, H - 64);

    // 4. Initialize Blade Trail
    this.bladeTrail = new BladeTrail(this);

    // 5. Build Polished Modern Retro HUD
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

    // Score Pill (Top Left)
    const scorePill = this.add.container(130, 48).setDepth(200);
    const scoreShadow = this.add.rectangle(3, 3, 170, 44, 0xf4a0c0).setOrigin(0.5);
    const scoreBg = this.add.rectangle(0, 0, 170, 44, 0xffffff).setOrigin(0.5);
    scoreBg.setStrokeStyle(2, 0x3d3037);

    this.scoreText = this.add.text(0, 0, 'SCORE: 0', {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '18px',
      color: '#33252d',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    scorePill.add([scoreShadow, scoreBg, this.scoreText]);

    // High Score Pill (Top Center)
    const hsPill = this.add.container(W / 2, 48).setDepth(200);
    const hsShadow = this.add.rectangle(3, 3, 210, 40, 0xe9d5ff).setOrigin(0.5);
    const hsBg = this.add.rectangle(0, 0, 210, 40, 0xffffff).setOrigin(0.5);
    hsBg.setStrokeStyle(2, 0x3d3037);

    this.highScoreText = this.add.text(0, 0, `BEST: ${this.highScore}`, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '16px',
      color: '#7c3aed',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    hsPill.add([hsShadow, hsBg, this.highScoreText]);

    // Misses Pill (Top Right)
    const missPill = this.add.container(W - 130, 48).setDepth(200);
    const missShadow = this.add.rectangle(3, 3, 160, 44, 0xfecdd3).setOrigin(0.5);
    const missBg = this.add.rectangle(0, 0, 160, 44, 0xffffff).setOrigin(0.5);
    missBg.setStrokeStyle(2, 0x3d3037);

    this.missIcons = [];
    const iconStartX = -44;
    for (let i = 0; i < FRUIT_NINJA_CONSTANTS.GAMEPLAY.MAX_MISSES; i++) {
      const heart = this.add.text(iconStartX + i * 44, 0, '♥', {
        fontFamily: 'sans-serif',
        fontSize: '24px',
        color: '#f43f5e'
      }).setOrigin(0.5);
      this.missIcons.push(heart);
    }
    missPill.add([missShadow, missBg, ...this.missIcons]);
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

    // Clear active entities
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

    // 1. Read Pointer with Viewport Scaling
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

    // 2. Update Fluid Blade Trail
    this.bladeTrail.addPoint(px, py, currentTime);
    this.bladeTrail.update(currentTime);

    const currentPointer = { x: px, y: py };

    if (!this.isGameOver) {
      // 3. Optimized Slicing Detection
      if (this.lastPointer) {
        const moveDist = Math.hypot(
          currentPointer.x - this.lastPointer.x,
          currentPointer.y - this.lastPointer.y
        );
        // Requires real swipe motion to cut
        if (moveDist >= 3.5) {
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
        // Dynamically ramp up difficulty
        this.currentSpawnInterval = Math.max(
          FRUIT_NINJA_CONSTANTS.GAMEPLAY.SPAWN_INTERVAL_MIN,
          this.currentSpawnInterval - 0.035
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
      // Bomb sliced: immediate camera shake & game over!
      this.triggerBombExplosion(fruit.x, fruit.y);
      this.triggerGameOver('BOMB DETONATED!');
      return;
    }

    // Fruit sliced: Trigger visual effects
    if (fruit.config) {
      // 1. Razor sharp slash flash line
      this.createSlashFlash(impactPoint.x, impactPoint.y, sliceAngle);

      // 2. Juicy tatami splat decal on background
      this.createDojoSplatDecal(impactPoint.x, impactPoint.y, fruit.config);

      // 3. Split halves with outward impulse
      this.createSplitHalves(fruit, sliceAngle);

      // 4. Spray droplet particles
      this.createJuiceSplatter(impactPoint.x, impactPoint.y, fruit.config, sliceAngle);

      // 5. Increment combo count
      this.comboCount++;
      this.comboTimer = FRUIT_NINJA_CONSTANTS.GAMEPLAY.COMBO_WINDOW_SECONDS;

      // 6. Base score & popup
      const pts = fruit.config.points;
      this.score += pts;
      this.showScorePopup(fruit.x, fruit.y, `+${pts}`, fruit.config.juiceColor);

      this.updateHUD();
    }
  }

  private createSlashFlash(x: number, y: number, angle: number): void {
    const flash = this.add.sprite(x, y, 'slash_flash');
    flash.setRotation(angle);
    flash.setDepth(120);
    flash.setScale(0.8, 1.2);

    this.tweens.add({
      targets: flash,
      scaleX: 1.6,
      scaleY: 0.2,
      alpha: 0,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy()
    });
  }

  private createDojoSplatDecal(x: number, y: number, fruit: FruitConfig): void {
    const decalIndex = Math.floor(Math.random() * 3);
    const decal = this.add.sprite(x, y, `splat_decal_${decalIndex}`);
    const tintColor = parseInt(fruit.juiceColor.replace('#', ''), 16);

    decal.setTint(tintColor);
    decal.setDepth(-5); // Above mat, below fruits and blade
    decal.setRotation(Math.random() * Math.PI * 2);
    decal.setScale(0.3);
    decal.setAlpha(0.65);

    // Pop scale in
    this.tweens.add({
      targets: decal,
      scale: 0.8 + Math.random() * 0.3,
      duration: 80,
      ease: 'Back.easeOut'
    });

    // Slow fade out over 3.5 seconds
    this.tweens.add({
      targets: decal,
      alpha: 0,
      delay: 2400,
      duration: 1200,
      ease: 'Quad.easeIn',
      onComplete: () => decal.destroy()
    });
  }

  private createSplitHalves(fruit: ActiveFruit, sliceAngle: number): void {
    if (!fruit.config) return;

    // Outward impulse perpendicular to cut
    const outwardAngle = sliceAngle + Math.PI / 2;
    const outwardSpeed = FRUIT_NINJA_CONSTANTS.PHYSICS.SPLIT_OUTWARD_SPEED + Math.random() * 40;

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
      rotationSpeed: -3.2
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
      rotationSpeed: 3.2
    });
  }

  private createJuiceSplatter(x: number, y: number, fruit: FruitConfig, sliceAngle: number): void {
    const count = 16;
    const juiceTint = parseInt(fruit.juiceColor.replace('#', ''), 16);

    for (let i = 0; i < count; i++) {
      // Direct droplets along the slice cut and perpendicular splash
      const baseAngle = i % 2 === 0 ? sliceAngle + (Math.PI / 2) : sliceAngle - (Math.PI / 2);
      const angle = baseAngle + (Math.random() - 0.5) * 0.8;
      const speed = 140 + Math.random() * 320;

      const dropletType = Math.floor(Math.random() * 3);
      const pSprite = this.add.sprite(x, y, `droplet_${dropletType}`);
      pSprite.setTint(juiceTint);
      pSprite.setDepth(25);

      this.particles.push({
        sprite: pSprite,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        lifetime: 0,
        maxLifetime: 0.4 + Math.random() * 0.3
      });
    }
  }

  private triggerBombExplosion(x: number, y: number): void {
    this.cameras.main.shake(350, 0.025);
    this.cameras.main.flash(200, 255, 240, 245);

    // Dark smoke sparks
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 180 + Math.random() * 420;

      const pSprite = this.add.sprite(x, y, 'droplet_1');
      pSprite.setTint(0x262024);
      pSprite.setDepth(50);

      this.particles.push({
        sprite: pSprite,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        lifetime: 0,
        maxLifetime: 0.55
      });
    }
  }

  private evaluateCombo(): void {
    if (this.comboCount >= 2) {
      const bonus = this.comboCount;
      this.score += bonus;

      const W = FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH;
      const H = FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT;

      // Stylized Combo Banner Popup
      this.showComboBanner(W / 2, H / 2 - 80, this.comboCount, bonus);
      this.updateHUD();
    }
    this.comboCount = 0;
  }

  private showComboBanner(x: number, y: number, count: number, bonus: number): void {
    const banner = this.add.container(x, y).setDepth(250);

    const shadow = this.add.rectangle(4, 4, 300, 56, 0xf4a0c0).setOrigin(0.5);
    const bg = this.add.rectangle(0, 0, 300, 56, 0xffffff).setOrigin(0.5);
    bg.setStrokeStyle(2.5, 0x3d3037);

    const text = this.add.text(0, 0, `COMBO x${count}! +${bonus}`, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '22px',
      color: '#db2777',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    banner.add([shadow, bg, text]);
    banner.setScale(0.4);

    this.tweens.add({
      targets: banner,
      scale: 1.15,
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: banner,
          scale: 1.0,
          y: y - 40,
          alpha: 0,
          delay: 450,
          duration: 350,
          ease: 'Quad.easeIn',
          onComplete: () => banner.destroy()
        });
      }
    });
  }

  private spawnWave(): void {
    const waveSize = 1 + Math.floor(Math.random() * 3);
    const spawnBomb = Math.random() < FRUIT_NINJA_CONSTANTS.GAMEPLAY.BOMB_SPAWN_CHANCE;

    for (let i = 0; i < waveSize; i++) {
      this.time.delayedCall(i * 140, () => {
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
      sliced: false,
      sparkTimer: 0
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

      // Bomb fuse spark animation while flying
      if (f.type === 'bomb' && !f.sliced) {
        f.sparkTimer = (f.sparkTimer || 0) + dt;
        if (f.sparkTimer > 0.08) {
          f.sparkTimer = 0;
          this.emitFuseSpark(f.x, f.y);
        }
      }

      // Dropped past bottom
      if (f.y > H + 50 && f.vy > 0) {
        if (!f.sliced && f.type === 'fruit') {
          this.handleMiss(f.x);
        }

        f.sprite.destroy();
        this.activeFruits.splice(i, 1);
      }
    }
  }

  private emitFuseSpark(x: number, y: number): void {
    const spark = this.add.sprite(x + 2, y - 28, 'droplet_0');
    spark.setTint(Math.random() > 0.5 ? 0xf59e0b : 0xfde047);
    spark.setScale(0.8);
    spark.setDepth(12);

    this.tweens.add({
      targets: spark,
      x: spark.x + (Math.random() - 0.5) * 16,
      y: spark.y - 12 - Math.random() * 10,
      alpha: 0,
      scale: 0.2,
      duration: 160,
      onComplete: () => spark.destroy()
    });
  }

  private handleMiss(x: number): void {
    this.misses++;
    this.updateHUD();

    // Show visual red X on bottom where fruit dropped
    const cross = this.add.text(x, FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT - 40, '✕', {
      fontFamily: 'Comfortaa, monospace',
      fontSize: '32px',
      color: '#e11d48',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(150);

    this.tweens.add({
      targets: cross,
      alpha: 0,
      y: cross.y - 30,
      scale: 1.3,
      duration: 600,
      ease: 'Quad.easeOut',
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

      p.vy += 500 * dt; // Gravity on juice droplets
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

  private showScorePopup(x: number, y: number, text: string, color: string): void {
    const popup = this.add.text(x, y, text, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '22px',
      color,
      fontStyle: 'bold',
      stroke: '#3d3037',
      strokeThickness: 2.5
    }).setOrigin(0.5).setDepth(150);

    this.tweens.add({
      targets: popup,
      y: y - 48,
      scale: 1.3,
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
        this.missIcons[i].setColor('#94a3b8');
      } else {
        this.missIcons[i].setText('♥');
        this.missIcons[i].setColor('#f43f5e');
      }
    }
  }

  private triggerGameOver(reason: string): void {
    this.isGameOver = true;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      StorageManager.saveHighScore('fruitninja', this.highScore);
    }

    const W = FRUIT_NINJA_CONSTANTS.CANVAS.WIDTH;
    const H = FRUIT_NINJA_CONSTANTS.CANVAS.HEIGHT;

    // Polished Game Over Modal Card
    this.gameOverContainer = this.add.container(W / 2, H / 2).setDepth(300);

    const cardShadow = this.add.rectangle(6, 6, 420, 300, 0xf4a0c0);
    cardShadow.setDepth(-1);

    const card = this.add.rectangle(0, 0, 420, 300, 0xffffff);
    card.setStrokeStyle(2.5, 0x3d3037);

    const title = this.add.text(0, -90, reason, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '22px',
      color: '#e11d48',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const finalScore = this.add.text(0, -30, `FINAL SCORE: ${this.score}`, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '26px',
      color: '#33252d',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const bestScore = this.add.text(0, 18, `ALL TIME BEST: ${this.highScore}`, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '16px',
      color: '#7c3aed',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Play Again Tactile Button
    const restartBtnContainer = this.add.container(0, 80);
    const btnShadow = this.add.rectangle(3, 3, 200, 46, 0xec4899);
    const btnBg = this.add.rectangle(0, 0, 200, 46, 0xf472b6);
    btnBg.setStrokeStyle(2, 0x3d3037);
    btnBg.setInteractive({ useHandCursor: true });

    const btnText = this.add.text(0, 0, 'PLAY AGAIN', {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    btnBg.on('pointerdown', () => {
      this.resetGame();
    });

    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0xec4899);
    });

    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0xf472b6);
    });

    restartBtnContainer.add([btnShadow, btnBg, btnText]);

    this.gameOverContainer.add([cardShadow, card, title, finalScore, bestScore, restartBtnContainer]);
    this.gameOverContainer.setScale(0.7);

    this.tweens.add({
      targets: this.gameOverContainer,
      scale: 1,
      duration: 250,
      ease: 'Back.easeOut'
    });
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
