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
  private splineBuffer: TrailPoint[] = [];

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100); // Blade renders above fruits
  }

  public addPoint(x: number, y: number, time: number): void {
    if (this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      const dist = Math.hypot(x - last.x, y - last.y);
      // Avoid clustering points that are too close together
      if (dist < 3.0) return;
    }

    this.points.push({ x, y, time });
  }

  public update(currentTime: number): void {
    const lifetime = FRUIT_NINJA_CONSTANTS.BLADE.TRAIL_LIFETIME_SECONDS;
    // In-place expiration without array re-allocation
    while (this.points.length > 0 && currentTime - this.points[0].time >= lifetime) {
      this.points.shift();
    }

    this.render();
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
   * Generates smoothly curved spline points reusing splineBuffer.
   */
  private generateSplinePoints(): TrailPoint[] {
    const pts = this.points;
    this.splineBuffer.length = 0;

    if (pts.length < 3) {
      for (let i = 0; i < pts.length; i++) {
        this.splineBuffer.push(pts[i]);
      }
      return this.splineBuffer;
    }

    const stepsPerSegment = 2;

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
        this.splineBuffer.push({ x, y, time });
      }
    }

    this.splineBuffer.push(pts[pts.length - 1]);
    return this.splineBuffer;
  }

  private render(): void {
    this.graphics.clear();

    if (this.points.length < 2) return;

    const splinePoints = this.generateSplinePoints();
    if (splinePoints.length < 2) return;

    const baseWidth = FRUIT_NINJA_CONSTANTS.BLADE.BASE_WIDTH;

    // Batched Pass 1: Outer glowing aura (soft baby pink)
    this.graphics.lineStyle(baseWidth + 6, 0xf472b6, 0.4);
    this.graphics.beginPath();
    this.graphics.moveTo(splinePoints[0].x, splinePoints[0].y);
    for (let i = 1; i < splinePoints.length; i++) {
      this.graphics.lineTo(splinePoints[i].x, splinePoints[i].y);
    }
    this.graphics.strokePath();

    // Batched Pass 2: Vibrant mid blade
    this.graphics.lineStyle(baseWidth, 0xec4899, 0.85);
    this.graphics.beginPath();
    this.graphics.moveTo(splinePoints[0].x, splinePoints[0].y);
    for (let i = 1; i < splinePoints.length; i++) {
      this.graphics.lineTo(splinePoints[i].x, splinePoints[i].y);
    }
    this.graphics.strokePath();

    // Batched Pass 3: Gleaming razor-sharp white core
    this.graphics.lineStyle(Math.max(1, baseWidth * 0.35), 0xffffff, 0.95);
    this.graphics.beginPath();
    this.graphics.moveTo(splinePoints[0].x, splinePoints[0].y);
    for (let i = 1; i < splinePoints.length; i++) {
      this.graphics.lineTo(splinePoints[i].x, splinePoints[i].y);
    }
    this.graphics.strokePath();

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
    this.splineBuffer = [];
  }
}
