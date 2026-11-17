import * as Phaser from 'phaser';
import { SPACE_FIGHTER_CONSTANTS } from './constants';

export interface Bullet {
  sprite: Phaser.GameObjects.Sprite;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isEnemy: boolean;
}

export type EnemyType = 'scout' | 'bomber' | 'cruiser';

export interface Enemy {
  sprite: Phaser.GameObjects.Sprite;
  active: boolean;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  points: number;
  radius: number;
  timeAlive: number;
  initialX: number;
  fireTimer: number;
  diveTargetX?: number;
  isDiving?: boolean;
}

export class BulletPool {
  private playerBullets: Bullet[] = [];
  private enemyBullets: Bullet[] = [];

  constructor(scene: Phaser.Scene) {
    // 1. Pre-allocate Player Bullets
    for (let i = 0; i < SPACE_FIGHTER_CONSTANTS.BULLETS.POOL_SIZE_PLAYER; i++) {
      const sprite = scene.add.sprite(0, 0, 'player_bullet');
      sprite.setActive(false).setVisible(false).setDepth(20);
      this.playerBullets.push({
        sprite,
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: SPACE_FIGHTER_CONSTANTS.BULLETS.RADIUS_PLAYER,
        isEnemy: false
      });
    }

    // 2. Pre-allocate Enemy Bullets
    for (let i = 0; i < SPACE_FIGHTER_CONSTANTS.BULLETS.POOL_SIZE_ENEMY; i++) {
      const sprite = scene.add.sprite(0, 0, 'enemy_bullet');
      sprite.setActive(false).setVisible(false).setDepth(20);
      this.enemyBullets.push({
        sprite,
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: SPACE_FIGHTER_CONSTANTS.BULLETS.RADIUS_ENEMY,
        isEnemy: true
      });
    }
  }

  public spawnPlayerBullet(x: number, y: number): Bullet | null {
    const bullet = this.playerBullets.find((b) => !b.active);
    if (!bullet) return null;

    bullet.active = true;
    bullet.x = x;
    bullet.y = y;
    bullet.vx = 0;
    bullet.vy = SPACE_FIGHTER_CONSTANTS.BULLETS.PLAYER_SPEED;

    bullet.sprite.setPosition(x, y).setActive(true).setVisible(true);
    return bullet;
  }

  public spawnEnemyBullet(x: number, y: number, vx: number, vy: number): Bullet | null {
    const bullet = this.enemyBullets.find((b) => !b.active);
    if (!bullet) return null;

    bullet.active = true;
    bullet.x = x;
    bullet.y = y;
    bullet.vx = vx;
    bullet.vy = vy;

    bullet.sprite.setPosition(x, y).setActive(true).setVisible(true);
    return bullet;
  }

  public recycle(bullet: Bullet): void {
    bullet.active = false;
    bullet.sprite.setActive(false).setVisible(false);
  }

  public update(dt: number): void {
    const H = SPACE_FIGHTER_CONSTANTS.CANVAS.HEIGHT;
    const W = SPACE_FIGHTER_CONSTANTS.CANVAS.WIDTH;

    // Update Player Bullets
    for (const b of this.playerBullets) {
      if (!b.active) continue;

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.sprite.setPosition(b.x, b.y);

      // Off-screen boundary check
      if (b.y < -30 || b.x < -30 || b.x > W + 30) {
        this.recycle(b);
      }
    }

    // Update Enemy Bullets
    for (const b of this.enemyBullets) {
      if (!b.active) continue;

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.sprite.setPosition(b.x, b.y);

      if (b.y > H + 30 || b.x < -30 || b.x > W + 30) {
        this.recycle(b);
      }
    }
  }

  public getActivePlayerBullets(): Bullet[] {
    return this.playerBullets.filter((b) => b.active);
  }

  public getActiveEnemyBullets(): Bullet[] {
    return this.enemyBullets.filter((b) => b.active);
  }

  public clearAll(): void {
    for (const b of this.playerBullets) this.recycle(b);
    for (const b of this.enemyBullets) this.recycle(b);
  }

  public destroy(): void {
    for (const b of this.playerBullets) b.sprite.destroy();
    for (const b of this.enemyBullets) b.sprite.destroy();
    this.playerBullets = [];
    this.enemyBullets = [];
  }
}

export class EnemyPool {
  private pool: Enemy[] = [];

  constructor(scene: Phaser.Scene) {
    // Pre-allocate pool with placeholder textures
    for (let i = 0; i < SPACE_FIGHTER_CONSTANTS.ENEMIES.POOL_SIZE; i++) {
      const sprite = scene.add.sprite(0, 0, 'enemy_scout');
      sprite.setActive(false).setVisible(false).setDepth(15);
      this.pool.push({
        sprite,
        active: false,
        type: 'scout',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        health: 1,
        maxHealth: 1,
        points: 100,
        radius: 20,
        timeAlive: 0,
        initialX: 0,
        fireTimer: 0
      });
    }
  }

  public spawn(type: EnemyType, x: number, y: number): Enemy | null {
    const enemy = this.pool.find((e) => !e.active);
    if (!enemy) return null;

    const config =
      type === 'scout'
        ? SPACE_FIGHTER_CONSTANTS.ENEMIES.TYPES.SCOUT
        : type === 'bomber'
        ? SPACE_FIGHTER_CONSTANTS.ENEMIES.TYPES.BOMBER
        : SPACE_FIGHTER_CONSTANTS.ENEMIES.TYPES.CRUISER;

    enemy.active = true;
    enemy.type = type;
    enemy.x = x;
    enemy.y = y;
    enemy.initialX = x;
    enemy.health = config.health;
    enemy.maxHealth = config.health;
    enemy.points = config.points;
    enemy.radius = config.radius;
    enemy.timeAlive = 0;
    enemy.fireTimer = Math.random() * 1.5;
    enemy.isDiving = false;
    enemy.diveTargetX = undefined;

    enemy.sprite.setTexture(`enemy_${type}`);
    enemy.sprite.setPosition(x, y).setActive(true).setVisible(true);
    return enemy;
  }

  public recycle(enemy: Enemy): void {
    enemy.active = false;
    enemy.sprite.setActive(false).setVisible(false);
  }

  public update(dt: number, playerX: number, bulletPool: BulletPool): void {
    const H = SPACE_FIGHTER_CONSTANTS.CANVAS.HEIGHT;

    for (const e of this.pool) {
      if (!e.active) continue;

      e.timeAlive += dt;

      if (e.type === 'scout') {
        // Sine wave movement
        const cfg = SPACE_FIGHTER_CONSTANTS.ENEMIES.TYPES.SCOUT;
        e.y += cfg.speedY * dt;
        e.x = e.initialX + Math.sin(e.timeAlive * cfg.frequency) * cfg.amplitude;
      } else if (e.type === 'bomber') {
        const cfg = SPACE_FIGHTER_CONSTANTS.ENEMIES.TYPES.BOMBER;
        // Dive bomber enters slowly, then swoops aggressively toward playerX
        if (!e.isDiving && e.y > 140) {
          e.isDiving = true;
          e.diveTargetX = playerX;
        }

        if (e.isDiving) {
          e.y += cfg.chargeSpeed * dt;
          if (e.diveTargetX !== undefined) {
            e.x += (e.diveTargetX - e.x) * 3.5 * dt;
          }
        } else {
          e.y += cfg.speedY * dt;
        }
      } else if (e.type === 'cruiser') {
        const cfg = SPACE_FIGHTER_CONSTANTS.ENEMIES.TYPES.CRUISER;
        e.y += cfg.speedY * dt;

        // Cruiser shoots plasma orbs downward periodically
        e.fireTimer += dt;
        if (e.fireTimer >= cfg.fireInterval) {
          e.fireTimer = 0;
          bulletPool.spawnEnemyBullet(e.x - 14, e.y + 20, -30, SPACE_FIGHTER_CONSTANTS.BULLETS.ENEMY_SPEED);
          bulletPool.spawnEnemyBullet(e.x + 14, e.y + 20, 30, SPACE_FIGHTER_CONSTANTS.BULLETS.ENEMY_SPEED);
        }
      }

      e.sprite.setPosition(e.x, e.y);

      // Off-screen bottom check
      if (e.y > H + 50) {
        this.recycle(e);
      }
    }
  }

  public getActiveEnemies(): Enemy[] {
    return this.pool.filter((e) => e.active);
  }

  public clearAll(): void {
    for (const e of this.pool) this.recycle(e);
  }

  public destroy(): void {
    for (const e of this.pool) e.sprite.destroy();
    this.pool = [];
  }
}
