import { FRUIT_NINJA_CONSTANTS } from './constants';
import { Point } from './collision';

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
    if (this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      const dist = Math.hypot(x - last.x, y - last.y);
      // Avoid clustering points that are too close together
      if (dist < 2.5) return;
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

  public getRecentPoints(maxPoints = 4): Point[] {
    const slice = this.points.slice(-maxPoints);
    return slice.map((p) => ({ x: p.x, y: p.y }));
  }

  /**
   * Evaluates a Catmull-Rom spline point for parameter t in [0, 1] across p0, p1, p2, p3.
   */
  private catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      0.5 *
      (2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    );
  }

  /**
   * Generates smoothly curved spline points through raw input points.
   */
  private generateSplinePoints(): TrailPoint[] {
    const pts = this.points;
    if (pts.length < 3) return [...pts];

    const result: TrailPoint[] = [];
    const stepsPerSegment = 3;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      for (let step = 0; step < stepsPerSegment; step++) {
        const t = step / stepsPerSegment;
        const x = this.catmullRom(p0.x, p1.x, p2.x, p3.x, t);
        const y = this.catmullRom(p0.y, p1.y, p2.y, p3.y, t);
        const time = p1.time + (p2.time - p1.time) * t;
        result.push({ x, y, time });
      }
    }

    result.push(pts[pts.length - 1]);
    return result;
  }

  private render(currentTime: number): void {
    this.graphics.clear();

    if (this.points.length < 2) return;

    const lifetime = FRUIT_NINJA_CONSTANTS.BLADE.TRAIL_LIFETIME_SECONDS;
    const splinePoints = this.generateSplinePoints();

    if (splinePoints.length < 2) return;

    const baseWidth = FRUIT_NINJA_CONSTANTS.BLADE.BASE_WIDTH;

    // Pass 1: Outer glowing aura (soft baby pink)
    for (let i = 0; i < splinePoints.length - 1; i++) {
      const p1 = splinePoints[i];
      const p2 = splinePoints[i + 1];

      const age = Math.min(1, Math.max(0, (currentTime - p2.time) / lifetime));
      const life = 1 - age;

      // Bell-curved taper: sharp at tip, thick in middle, tapering at tail
      const taper = Math.sin(life * Math.PI * 0.5);
      const width = Math.max(1, taper * (baseWidth + 5));
      const alpha = Math.max(0, life * 0.4);

      this.graphics.lineStyle(width, 0xf472b6, alpha);
      this.graphics.beginPath();
      this.graphics.moveTo(p1.x, p1.y);
      this.graphics.lineTo(p2.x, p2.y);
      this.graphics.strokePath();
    }

    // Pass 2: Vibrant mid blade
    for (let i = 0; i < splinePoints.length - 1; i++) {
      const p1 = splinePoints[i];
      const p2 = splinePoints[i + 1];

      const age = Math.min(1, Math.max(0, (currentTime - p2.time) / lifetime));
      const life = 1 - age;
      const taper = Math.sin(life * Math.PI * 0.5);
      const width = Math.max(1, taper * baseWidth);
      const alpha = Math.max(0, life * 0.85);

      this.graphics.lineStyle(width, 0xec4899, alpha);
      this.graphics.beginPath();
      this.graphics.moveTo(p1.x, p1.y);
      this.graphics.lineTo(p2.x, p2.y);
      this.graphics.strokePath();
    }

    // Pass 3: Gleaming razor-sharp white core
    for (let i = 0; i < splinePoints.length - 1; i++) {
      const p1 = splinePoints[i];
      const p2 = splinePoints[i + 1];

      const age = Math.min(1, Math.max(0, (currentTime - p2.time) / lifetime));
      const life = 1 - age;
      const taper = Math.sin(life * Math.PI * 0.5);
      const width = Math.max(0.75, taper * (baseWidth * 0.4));
      const alpha = Math.max(0, life * 0.95);

      this.graphics.lineStyle(width, 0xffffff, alpha);
      this.graphics.beginPath();
      this.graphics.moveTo(p1.x, p1.y);
      this.graphics.lineTo(p2.x, p2.y);
      this.graphics.strokePath();
    }

    // Pass 4: Blade Tip Gleam Spark
    const tip = splinePoints[splinePoints.length - 1];
    if (this.points.length >= 2) {
      const prev = this.points[this.points.length - 2];
      const speed = Math.hypot(tip.x - prev.x, tip.y - prev.y);
      if (speed > 4) {
        this.graphics.fillStyle(0xffffff, 0.9);
        this.graphics.fillRect(tip.x - 2, tip.y - 2, 4, 4);
        this.graphics.fillStyle(0xfbcfe8, 0.6);
        this.graphics.fillRect(tip.x - 4, tip.y - 1, 8, 2);
        this.graphics.fillRect(tip.x - 1, tip.y - 4, 2, 8);
      }
    }
  }

  public destroy(): void {
    this.graphics.destroy();
    this.points = [];
  }
}
