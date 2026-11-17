import * as Phaser from 'phaser';
import { SPACE_FIGHTER_CONSTANTS } from './constants';
import { SpaceFighterTextureGenerator } from './textures';
import { Starfield } from './Starfield';
import { BulletPool, EnemyPool, Enemy } from './pools';
import { InputManager } from '../../input/InputManager';
import { StorageManager } from '../../shared/storage';

interface BossEntity {
  sprite: Phaser.GameObjects.Sprite;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  health: number;
  maxHealth: number;
  radius: number;
  attackTimer: number;
}

interface ExplosionParticle {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  lifetime: number;
  maxLifetime: number;
}

export class SpaceFighterScene extends Phaser.Scene {
  private inputManager!: InputManager;

  // Visuals & Pools
  private starfield!: Starfield;
  private bulletPool!: BulletPool;
  private enemyPool!: EnemyPool;
  private explosionParticles: ExplosionParticle[] = [];

  // Player state
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerX = 640;
  private playerY = 600;
  private playerVx = 0;
  private playerVy = 0;
  private lives = SPACE_FIGHTER_CONSTANTS.PLAYER.INITIAL_LIVES;
  private fireTimer = 0;
  private invulnerableTimer = 0;
  private isGameOver = false;
  private isGamePaused = false;

  // Wave & Game Progression
  private currentWave = 1;
  private waveEnemiesRemaining = 0;
  private isInterWave = false;
  private boss: BossEntity | null = null;

  // Scoring
  private score = 0;
  private highScore = 0;

  // UI GameObjects
  private scoreText!: Phaser.GameObjects.Text;
  private highScoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private lifeIcons: Phaser.GameObjects.Sprite[] = [];
  private bossHealthContainer?: Phaser.GameObjects.Container;
  private bossHealthBar?: Phaser.GameObjects.Rectangle;
  private bannerText?: Phaser.GameObjects.Text;
  private gameOverContainer?: Phaser.GameObjects.Container;
  private unsubPressA?: () => void;

  constructor() {
    super({ key: 'SpaceFighterScene' });
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
    const W = SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH;
    const H = SPACE_FIGHTER_CONSTANTS.CANVAS.HEIGHT;

    // 1. Generate programmatic vector textures
    SpaceFighterTextureGenerator.generateAll(this);

    // 2. High score from storage
    this.highScore = StorageManager.getHighScore('spacefighter');

    // 3. Deep cosmic background with soft nebula hue
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x181124);
    bg.setDepth(-100);

    // 4. Parallax Starfield
    this.starfield = new Starfield(this);

    // 5. Object Pools
    this.bulletPool = new BulletPool(this);
    this.enemyPool = new EnemyPool(this);

    // 6. Player Ship
    this.playerX = W / 2;
    this.playerY = H - 100;
    this.playerSprite = this.add.sprite(this.playerX, this.playerY, 'player_ship');
    this.playerSprite.setDepth(30);

    // 7. HUD & Telemetry
    this.createHUD();

    // 8. Start Wave 1
    this.resetGame();

    // 9. Input Subscription: Press Button A
    if (this.inputManager) {
      this.unsubPressA = this.inputManager.on('pressA', () => {
        if (this.isGameOver) {
          this.resetGame();
        }
      });
    }
  }

  private createHUD(): void {
    const W = SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH;

    // Score Pill (Top Left)
    const scorePill = this.add.container(130, 44).setDepth(200);
    const scoreShadow = this.add.rectangle(3, 3, 170, 40, 0xf4a0c0).setOrigin(0.5);
    const scoreBg = this.add.rectangle(0, 0, 170, 40, 0xffffff).setOrigin(0.5);
    scoreBg.setStrokeStyle(2, 0x382c33);

    this.scoreText = this.add.text(0, 0, 'SCORE: 0', {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '17px',
      color: '#33252d',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    scorePill.add([scoreShadow, scoreBg, this.scoreText]);

    // High Score Pill (Top Center Left)
    const hsPill = this.add.container(W / 2 - 130, 44).setDepth(200);
    const hsShadow = this.add.rectangle(3, 3, 190, 40, 0xe9d5ff).setOrigin(0.5);
    const hsBg = this.add.rectangle(0, 0, 190, 40, 0xffffff).setOrigin(0.5);
    hsBg.setStrokeStyle(2, 0x382c33);

    this.highScoreText = this.add.text(0, 0, `BEST: ${this.highScore}`, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '15px',
      color: '#7c3aed',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    hsPill.add([hsShadow, hsBg, this.highScoreText]);

    // Wave Pill (Top Center Right)
    const wavePill = this.add.container(W / 2 + 130, 44).setDepth(200);
    const waveShadow = this.add.rectangle(3, 3, 170, 40, 0xfef08a).setOrigin(0.5);
    const waveBg = this.add.rectangle(0, 0, 170, 40, 0xffffff).setOrigin(0.5);
    waveBg.setStrokeStyle(2, 0x382c33);

    this.waveText = this.add.text(0, 0, 'WAVE 1', {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '16px',
      color: '#b45309',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    wavePill.add([waveShadow, waveBg, this.waveText]);

    // Lives Pill (Top Right)
    const livesPill = this.add.container(W - 130, 44).setDepth(200);
    const livesShadow = this.add.rectangle(3, 3, 150, 40, 0xfecdd3).setOrigin(0.5);
    const livesBg = this.add.rectangle(0, 0, 150, 40, 0xffffff).setOrigin(0.5);
    livesBg.setStrokeStyle(2, 0x382c33);

    this.lifeIcons = [];
    const startX = -36;
    for (let i = 0; i < SPACE_FIGHTER_CONSTANTS.PLAYER.INITIAL_LIVES; i++) {
      const icon = this.add.sprite(startX + i * 36, 0, 'player_ship');
      icon.setScale(0.55);
      this.lifeIcons.push(icon);
    }
    livesPill.add([livesShadow, livesBg, ...this.lifeIcons]);
  }

  private resetGame(): void {
    this.score = 0;
    this.lives = SPACE_FIGHTER_CONSTANTS.PLAYER.INITIAL_LIVES;
    this.currentWave = 1;
    this.isGameOver = false;
    this.isGamePaused = false;
    this.isInterWave = false;
    this.invulnerableTimer = 0;
    this.fireTimer = 0;
    this.playerX = SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH / 2;
    this.playerY = SPACE_FIGHTER_CONSTANTS.CANVAS.HEIGHT - 100;
    this.playerSprite.setPosition(this.playerX, this.playerY).setVisible(true).setAlpha(1);

    this.bulletPool.clearAll();
    this.enemyPool.clearAll();

    if (this.boss) {
      this.boss.sprite.destroy();
      this.boss = null;
    }
    this.bossHealthContainer?.destroy();
    this.bossHealthContainer = undefined;

    this.updateHUD();
    this.gameOverContainer?.destroy();
    this.gameOverContainer = undefined;

    this.startWave(1);
  }

  private startWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.updateHUD();

    const isBossWave = waveNumber % SPACE_FIGHTER_CONSTANTS.BOSS.WAVE_INTERVAL === 0;

    if (isBossWave) {
      this.showBanner('WARNING: MOTHERSHIP INCOMING!', '#e11d48', () => {
        this.spawnBoss();
      });
    } else {
      this.showBanner(`WAVE ${waveNumber}`, '#7c3aed', () => {
        this.spawnWaveEnemies(waveNumber);
      });
    }
  }

  private showBanner(text: string, color: string, onComplete?: () => void): void {
    const W = SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH;
    const H = SPACE_FIGHTER_CONSTANTS.CANVAS.HEIGHT;

    this.bannerText?.destroy();
    this.bannerText = this.add.text(W / 2, H / 2 - 40, text, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '32px',
      color,
      fontStyle: 'bold',
      stroke: '#ffffff',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(250).setScale(0.5).setAlpha(0);

    this.tweens.add({
      targets: this.bannerText,
      scale: 1.15,
      alpha: 1,
      duration: 350,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.bannerText,
          scale: 1.0,
          alpha: 0,
          delay: 800,
          duration: 300,
          onComplete: () => {
            this.bannerText?.destroy();
            this.bannerText = undefined;
            onComplete?.();
          }
        });
      }
    });
  }

  private spawnWaveEnemies(wave: number): void {
    const W = SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH;
    const enemyCount = 6 + wave * 2;
    this.waveEnemiesRemaining = enemyCount;

    for (let i = 0; i < enemyCount; i++) {
      this.time.delayedCall(i * 450, () => {
        if (this.isGameOver || this.isGamePaused) return;

        // Choose enemy type based on wave progression
        let type: 'scout' | 'bomber' | 'cruiser' = 'scout';
        const roll = Math.random();
        if (wave >= 3 && roll < 0.3) {
          type = 'cruiser';
        } else if (wave >= 2 && roll < 0.65) {
          type = 'bomber';
        }

        const spawnX = 120 + Math.random() * (W - 240);
        this.enemyPool.spawn(type, spawnX, -40);
        this.waveEnemiesRemaining--;
      });
    }
  }

  private spawnBoss(): void {
    const W = SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH;
    const cycle = Math.floor(this.currentWave / SPACE_FIGHTER_CONSTANTS.BOSS.WAVE_INTERVAL) - 1;
    const maxHp = SPACE_FIGHTER_CONSTANTS.BOSS.BASE_HEALTH + cycle * SPACE_FIGHTER_CONSTANTS.BOSS.HEALTH_PER_CYCLE;

    const sprite = this.add.sprite(W / 2, -80, 'boss_mothership').setDepth(25);

    this.boss = {
      sprite,
      active: true,
      x: W / 2,
      y: -80,
      vx: SPACE_FIGHTER_CONSTANTS.BOSS.SPEED_X,
      health: maxHp,
      maxHealth: maxHp,
      radius: SPACE_FIGHTER_CONSTANTS.BOSS.RADIUS,
      attackTimer: 0
    };

    // Fly in animation
    this.tweens.add({
      targets: this.boss,
      y: 130,
      duration: 1500,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.createBossHealthBar();
      }
    });
  }

  private createBossHealthBar(): void {
    const W = SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH;
    this.bossHealthContainer?.destroy();

    this.bossHealthContainer = this.add.container(W / 2, 85).setDepth(210);

    const bgShadow = this.add.rectangle(3, 3, 340, 18, 0x382c33).setOrigin(0.5);
    const bg = this.add.rectangle(0, 0, 340, 18, 0xffffff).setOrigin(0.5);
    bg.setStrokeStyle(1.5, 0x382c33);

    this.bossHealthBar = this.add.rectangle(-168, 0, 336, 14, 0xe11d48).setOrigin(0, 0.5);

    const label = this.add.text(0, -18, 'MOTHERSHIP', {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '12px',
      color: '#e11d48',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.bossHealthContainer.add([bgShadow, bg, this.bossHealthBar, label]);
  }

  private updateBossHealthBar(): void {
    if (!this.boss || !this.bossHealthBar) return;
    const pct = Math.max(0, this.boss.health / this.boss.maxHealth);
    this.bossHealthBar.width = 336 * pct;
  }

  public update(_time: number, delta: number): void {
    if (this.isGamePaused || !this.inputManager) return;

    const dt = Math.max(0.001, Math.min(delta / 1000, 0.1));

    // 1. Update Starfield Parallax
    this.starfield.update(dt);

    if (!this.isGameOver) {
      // 2. Player Controls (Tilt & Pointer)
      this.updatePlayerMovement(dt);

      // 3. Firing Lasers (Button A)
      this.updatePlayerFiring(dt);

      // 4. Update Bullets & Enemies
      this.bulletPool.update(dt);
      this.enemyPool.update(dt, this.playerX, this.bulletPool);

      // 5. Update Boss if active
      if (this.boss && this.boss.active) {
        this.updateBoss(dt);
      }

      // 6. Collision Checks
      this.checkCollisions();

      // 7. Check Wave Cleared Condition
      this.checkWaveProgress();
    }

    // 8. Update Explosion Particles
    this.updateParticles(dt);

    // 9. Invulnerability Blink
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      this.playerSprite.setAlpha(Math.sin(_time * 0.03) > 0 ? 0.3 : 1.0);
      if (this.invulnerableTimer <= 0) {
        this.playerSprite.setAlpha(1.0);
      }
    }
  }

  private updatePlayerMovement(dt: number): void {
    const W = SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH;
    const H = SPACE_FIGHTER_CONSTANTS.CANVAS.HEIGHT;
    const pad = SPACE_FIGHTER_CONSTANTS.PLAYER.BOUNDS_PADDING;
    const state = this.inputManager.getState();

    // Check if tilt motion input is present (Phone or Keyboard WASD)
    const hasTilt = Math.abs(state.tilt.roll) > 0.05 || Math.abs(state.tilt.pitch) > 0.05;

    if (hasTilt) {
      this.playerVx = state.tilt.roll * SPACE_FIGHTER_CONSTANTS.PLAYER.TILT_SENSITIVITY;
      this.playerVy = -state.tilt.pitch * SPACE_FIGHTER_CONSTANTS.PLAYER.TILT_SENSITIVITY;

      this.playerX += this.playerVx * dt;
      this.playerY += this.playerVy * dt;
    } else {
      // Smooth tracking towards Pointer position
      const canvas = this.game.canvas;
      let targetX = state.pointer.x * W;
      let targetY = state.pointer.y * H;

      if (canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        const rect = canvas.getBoundingClientRect();
        const screenX = state.pointer.x * window.innerWidth;
        const screenY = state.pointer.y * window.innerHeight;
        targetX = ((screenX - rect.left) / rect.width) * W;
        targetY = ((screenY - rect.top) / rect.height) * H;
      }

      const lerpFactor = Math.min(1, dt * SPACE_FIGHTER_CONSTANTS.PLAYER.POINTER_LERP);
      this.playerX += (targetX - this.playerX) * lerpFactor;
      this.playerY += (targetY - this.playerY) * lerpFactor;
    }

    // Clamp inside play area
    this.playerX = Phaser.Math.Clamp(this.playerX, pad, W - pad);
    this.playerY = Phaser.Math.Clamp(this.playerY, pad + 60, H - pad);

    this.playerSprite.setPosition(this.playerX, this.playerY);

    // Dynamic banking tilt roll
    const bankAngle = hasTilt ? state.tilt.roll * 0.35 : (this.playerVx / 500) * 0.25;
    this.playerSprite.setRotation(bankAngle);
  }

  private updatePlayerFiring(dt: number): void {
    this.fireTimer += dt;
    const state = this.inputManager.getState();

    if (state.buttonA && this.fireTimer >= SPACE_FIGHTER_CONSTANTS.PLAYER.FIRE_COOLDOWN_SECONDS) {
      this.fireTimer = 0;

      // Twin blasters from wing tips
      this.bulletPool.spawnPlayerBullet(this.playerX - 17, this.playerY - 8);
      this.bulletPool.spawnPlayerBullet(this.playerX + 17, this.playerY - 8);
    }
  }

  private updateBoss(dt: number): void {
    if (!this.boss) return;

    const W = SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH;
    const b = this.boss;

    // Horizontal patrol
    b.x += b.vx * dt;
    if (b.x < 140) {
      b.x = 140;
      b.vx = Math.abs(b.vx);
    } else if (b.x > W - 140) {
      b.x = W - 140;
      b.vx = -Math.abs(b.vx);
    }

    b.sprite.setPosition(b.x, b.y);

    // Boss Attack Patterns
    b.attackTimer += dt;
    if (b.attackTimer >= SPACE_FIGHTER_CONSTANTS.BOSS.ATTACK_COOLDOWN) {
      b.attackTimer = 0;

      // Twin heavy plasma shots
      this.bulletPool.spawnEnemyBullet(b.x - 30, b.y + 40, -40, SPACE_FIGHTER_CONSTANTS.BULLETS.ENEMY_SPEED * 1.15);
      this.bulletPool.spawnEnemyBullet(b.x + 30, b.y + 40, 40, SPACE_FIGHTER_CONSTANTS.BULLETS.ENEMY_SPEED * 1.15);

      // Phase 2: Below 50% HP, fires central triple spray
      if (b.health < b.maxHealth * 0.5) {
        this.bulletPool.spawnEnemyBullet(b.x, b.y + 50, 0, SPACE_FIGHTER_CONSTANTS.BULLETS.ENEMY_SPEED * 1.25);
        this.bulletPool.spawnEnemyBullet(b.x, b.y + 50, -80, SPACE_FIGHTER_CONSTANTS.BULLETS.ENEMY_SPEED);
        this.bulletPool.spawnEnemyBullet(b.x, b.y + 50, 80, SPACE_FIGHTER_CONSTANTS.BULLETS.ENEMY_SPEED);
      }
    }
  }

  private checkCollisions(): void {
    const playerBullets = this.bulletPool.getActivePlayerBullets();
    const enemies = this.enemyPool.getActiveEnemies();
    const enemyBullets = this.bulletPool.getActiveEnemyBullets();

    // 1. Player Bullets vs Enemies
    for (const b of playerBullets) {
      if (!b.active) continue;

      for (const e of enemies) {
        if (!e.active) continue;

        const distSq = (b.x - e.x) ** 2 + (b.y - e.y) ** 2;
        const hitRadius = b.radius + e.radius;

        if (distSq <= hitRadius * hitRadius) {
          this.bulletPool.recycle(b);
          this.damageEnemy(e);
          break;
        }
      }
    }

    // 2. Player Bullets vs Boss
    if (this.boss && this.boss.active) {
      for (const b of playerBullets) {
        if (!b.active) continue;

        const distSq = (b.x - this.boss.x) ** 2 + (b.y - this.boss.y) ** 2;
        const hitRadius = b.radius + this.boss.radius;

        if (distSq <= hitRadius * hitRadius) {
          this.bulletPool.recycle(b);
          this.damageBoss(1);
        }
      }
    }

    // 3. Enemy Bullets vs Player Ship
    if (this.invulnerableTimer <= 0) {
      const pRadius = SPACE_FIGHTER_CONSTANTS.PLAYER.HITBOX_RADIUS;

      for (const eb of enemyBullets) {
        if (!eb.active) continue;

        const distSq = (eb.x - this.playerX) ** 2 + (eb.y - this.playerY) ** 2;
        const hitRadius = eb.radius + pRadius;

        if (distSq <= hitRadius * hitRadius) {
          this.bulletPool.recycle(eb);
          this.hitPlayer();
          break;
        }
      }

      // 4. Enemy Ship Ramming vs Player Ship
      for (const e of enemies) {
        if (!e.active) continue;

        const distSq = (e.x - this.playerX) ** 2 + (e.y - this.playerY) ** 2;
        const hitRadius = e.radius + pRadius;

        if (distSq <= hitRadius * hitRadius) {
          this.enemyPool.recycle(e);
          this.hitPlayer();
          break;
        }
      }
    }
  }

  private damageEnemy(enemy: Enemy): void {
    enemy.health--;

    // White flash on hit
    enemy.sprite.setTint(0xffffff);
    this.time.delayedCall(50, () => {
      if (enemy.active) {
        enemy.sprite.clearTint();
      }
    });

    if (enemy.health <= 0) {
      this.enemyPool.recycle(enemy);
      this.createExplosion(enemy.x, enemy.y, 14);
      this.score += enemy.points;
      this.showScorePopup(enemy.x, enemy.y, `+${enemy.points}`, '#38bdf8');
      this.updateHUD();
    }
  }

  private damageBoss(dmg: number): void {
    if (!this.boss) return;

    this.boss.health -= dmg;
    this.updateBossHealthBar();

    // Damage flash
    this.boss.sprite.setTint(0xffffff);
    this.time.delayedCall(45, () => {
      if (this.boss) {
        this.boss.sprite.clearTint();
      }
    });

    if (this.boss.health <= 0) {
      this.defeatBoss();
    }
  }

  private defeatBoss(): void {
    if (!this.boss) return;

    const bx = this.boss.x;
    const by = this.boss.y;
    this.boss.active = false;
    this.boss.sprite.destroy();
    this.boss = null;
    this.bossHealthContainer?.destroy();
    this.bossHealthContainer = undefined;

    // Massive explosion sequence
    this.cameras.main.shake(600, 0.03);
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 120, () => {
        this.createExplosion(bx + (Math.random() - 0.5) * 80, by + (Math.random() - 0.5) * 60, 24);
      });
    }

    const pts = SPACE_FIGHTER_CONSTANTS.BOSS.POINTS;
    this.score += pts;
    this.showScorePopup(bx, by, `+${pts}`, '#f43f5e', 28);
    this.updateHUD();

    this.showBanner('BOSS DESTROYED!', '#4ade80', () => {
      this.startWave(this.currentWave + 1);
    });
  }

  private hitPlayer(): void {
    this.lives--;
    this.updateHUD();
    this.createExplosion(this.playerX, this.playerY, 18);
    this.cameras.main.shake(250, 0.02);

    if (this.lives <= 0) {
      this.triggerGameOver();
    } else {
      this.invulnerableTimer = SPACE_FIGHTER_CONSTANTS.PLAYER.INVULNERABILITY_SECONDS;
    }
  }

  private createExplosion(x: number, y: number, count = 16): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 280;
      const particleIdx = Math.floor(Math.random() * 5);

      const pSprite = this.add.sprite(x, y, `particle_debris_${particleIdx}`).setDepth(45);
      pSprite.setScale(0.8 + Math.random() * 0.5);

      this.explosionParticles.push({
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

  private updateParticles(dt: number): void {
    for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
      const p = this.explosionParticles[i];
      p.lifetime += dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const progress = p.lifetime / p.maxLifetime;
      p.alpha = Math.max(0, 1 - progress);
      p.sprite.setPosition(p.x, p.y).setAlpha(p.alpha);

      if (p.lifetime >= p.maxLifetime) {
        p.sprite.destroy();
        this.explosionParticles.splice(i, 1);
      }
    }
  }

  private checkWaveProgress(): void {
    const isBossWave = this.currentWave % SPACE_FIGHTER_CONSTANTS.BOSS.WAVE_INTERVAL === 0;
    if (isBossWave) return;

    const activeEnemies = this.enemyPool.getActiveEnemies();
    if (activeEnemies.length === 0 && !this.isInterWave && this.waveEnemiesRemaining <= 0) {
      this.isInterWave = true;

      this.showBanner('WAVE CLEAR!', '#22c55e', () => {
        this.isInterWave = false;
        this.startWave(this.currentWave + 1);
      });
    }
  }

  private showScorePopup(x: number, y: number, text: string, color: string, size = 20): void {
    const popup = this.add.text(x, y, text, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: `${size}px`,
      color,
      fontStyle: 'bold',
      stroke: '#382c33',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(150);

    this.tweens.add({
      targets: popup,
      y: y - 45,
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
      StorageManager.saveHighScore('spacefighter', this.highScore);
    }
    this.highScoreText.setText(`BEST: ${this.highScore}`);
    this.waveText.setText(`WAVE ${this.currentWave}`);

    // Update ship life icons
    for (let i = 0; i < this.lifeIcons.length; i++) {
      this.lifeIcons[i].setVisible(i < this.lives);
    }
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.playerSprite.setVisible(false);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      StorageManager.saveHighScore('spacefighter', this.highScore);
    }

    const W = SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH;
    const H = SPACE_FIGHTER_CONSTANTS.CANVAS.HEIGHT;

    this.gameOverContainer = this.add.container(W / 2, H / 2).setDepth(300);

    const shadow = this.add.rectangle(6, 6, 420, 310, 0xf4a0c0).setOrigin(0.5);
    const card = this.add.rectangle(0, 0, 420, 310, 0xffffff).setOrigin(0.5);
    card.setStrokeStyle(2.5, 0x382c33);

    const title = this.add.text(0, -90, 'MISSION FAILED', {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '24px',
      color: '#e11d48',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const scoreMsg = this.add.text(0, -35, `FINAL SCORE: ${this.score}`, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '24px',
      color: '#33252d',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const waveMsg = this.add.text(0, 5, `REACHED: WAVE ${this.currentWave}`, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '16px',
      color: '#b45309',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const bestMsg = this.add.text(0, 35, `ALL TIME BEST: ${this.highScore}`, {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '15px',
      color: '#7c3aed',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Play Again button
    const restartBtn = this.add.container(0, 95);
    const btnShadow = this.add.rectangle(3, 3, 200, 46, 0xec4899);
    const btnBg = this.add.rectangle(0, 0, 200, 46, 0xf472b6);
    btnBg.setStrokeStyle(2, 0x382c33).setInteractive({ useHandCursor: true });

    const btnText = this.add.text(0, 0, 'PLAY AGAIN', {
      fontFamily: 'Comfortaa, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    btnBg.on('pointerdown', () => this.resetGame());
    btnBg.on('pointerover', () => btnBg.setFillStyle(0xec4899));
    btnBg.on('pointerout', () => btnBg.setFillStyle(0xf472b6));

    restartBtn.add([btnShadow, btnBg, btnText]);
    this.gameOverContainer.add([shadow, card, title, scoreMsg, waveMsg, bestMsg, restartBtn]);
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

    this.starfield?.destroy();
    this.bulletPool?.destroy();
    this.enemyPool?.destroy();

    for (const p of this.explosionParticles) {
      p.sprite.destroy();
    }
    this.explosionParticles = [];

    if (this.boss) {
      this.boss.sprite.destroy();
      this.boss = null;
    }
    this.bossHealthContainer?.destroy();
    this.gameOverContainer?.destroy();
  }
}
