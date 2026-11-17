import { FRUIT_NINJA_CONSTANTS } from './constants';

export interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

export class BladeTrail {
  private graphics: Phaser.GameObjects.Graphics;
  private points: TrailPoint[] = [];

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100); // Blade renders above fruits
  }

  public addPoint(x: number, y: number, time: number): void {
    // Only add if moving or at reasonable distance
    if (this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      const dist = Math.hypot(x - last.x, y - last.y);
      if (dist < 2) return;
    }

    this.points.push({ x, y, time });
  }

  public update(currentTime: number): void {
    const lifetime = FRUIT_NINJA_CONSTANTS.BLADE.TRAIL_LIFETIME_SECONDS;
    this.points = this.points.filter((p) => currentTime - p.time < lifetime);

    this.render(currentTime);
  }

  public getPoints(): readonly TrailPoint[] {
    return this.points;
  }

  public getLatestSegment(): [TrailPoint, TrailPoint] | null {
    if (this.points.length < 2) return null;
    return [this.points[this.points.length - 2], this.points[this.points.length - 1]];
  }

  private render(currentTime: number): void {
    this.graphics.clear();

    if (this.points.length < 2) return;

    const lifetime = FRUIT_NINJA_CONSTANTS.BLADE.TRAIL_LIFETIME_SECONDS;

    // Draw outer baby-pink blade glow
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];

      const age = (currentTime - p2.time) / lifetime;
      const alpha = Math.max(0, 1 - age);
      const width = Math.max(1, (1 - age) * FRUIT_NINJA_CONSTANTS.BLADE.BASE_WIDTH);

      // Pink outer edge
      this.graphics.lineStyle(width + 4, 0xf472b6, alpha * 0.9);
      this.graphics.beginPath();
      this.graphics.moveTo(p1.x, p1.y);
      this.graphics.lineTo(p2.x, p2.y);
      this.graphics.strokePath();

      // White inner sharp core
      this.graphics.lineStyle(Math.max(1, width), 0xffffff, alpha);
      this.graphics.beginPath();
      this.graphics.moveTo(p1.x, p1.y);
      this.graphics.lineTo(p2.x, p2.y);
      this.graphics.strokePath();
    }
  }

  public destroy(): void {
    this.graphics.destroy();
    this.points = [];
  }
}
