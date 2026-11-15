export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Clamps a number between min and max bounds.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between a and b.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Exponential Moving Average (EMA).
 * alpha = 1: immediate update (no smoothing).
 * alpha close to 0: heavy smoothing.
 */
export function ema(current: number, target: number, alpha: number): number {
  const safeAlpha = clamp(alpha, 0, 1);
  return current + safeAlpha * (target - current);
}

/**
 * 2D Exponential Moving Average for Vector2D.
 */
export function ema2D(current: Vector2D, target: Vector2D, alpha: number): Vector2D {
  return {
    x: ema(current.x, target.x, alpha),
    y: ema(current.y, target.y, alpha)
  };
}

/**
 * Low-pass filter for noisy signal streams (e.g. accelerometer, pointer velocity).
 */
export function lowPass(previous: number, current: number, alpha: number): number {
  return ema(previous, current, alpha);
}
