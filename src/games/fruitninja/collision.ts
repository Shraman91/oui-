export interface Point {
  x: number;
  y: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface SliceIntersection {
  hit: boolean;
  sliceAngle: number;
  impactPoint: Point;
}

/**
 * Checks if a line segment (P1 to P2) intersects a circle (C, radius).
 * Utilizes fast AABB rejection prior to geometric projection.
 * Returns hit boolean, slice angle (radians), and impact point on the circle.
 */
export function checkSegmentCircleCollision(
  p1: Point,
  p2: Point,
  circle: Circle
): SliceIntersection {
  const r = circle.radius;

  // 1. Fast AABB Bounding Box Rejection (O(1))
  const minX = Math.min(p1.x, p2.x) - r;
  const maxX = Math.max(p1.x, p2.x) + r;
  const minY = Math.min(p1.y, p2.y) - r;
  const maxY = Math.max(p1.y, p2.y) + r;

  if (circle.x < minX || circle.x > maxX || circle.y < minY || circle.y > maxY) {
    return { hit: false, sliceAngle: 0, impactPoint: { x: circle.x, y: circle.y } };
  }

  // 2. Vector Projection onto segment
  const vx = p2.x - p1.x;
  const vy = p2.y - p1.y;
  const wx = circle.x - p1.x;
  const wy = circle.y - p1.y;

  const lenSq = vx * vx + vy * vy;
  if (lenSq < 0.0001) {
    // Stationary segment: point distance check
    const dSq = wx * wx + wy * wy;
    if (dSq <= r * r) {
      return {
        hit: true,
        sliceAngle: 0,
        impactPoint: { x: p1.x, y: p1.y }
      };
    }
    return { hit: false, sliceAngle: 0, impactPoint: { x: circle.x, y: circle.y } };
  }

  // Projection parameter t
  const t = (wx * vx + wy * vy) / lenSq;
  const clampedT = Math.max(0, Math.min(1, t));

  // Closest point on the segment
  const closestX = p1.x + clampedT * vx;
  const closestY = p1.y + clampedT * vy;

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq <= r * r) {
    return {
      hit: true,
      sliceAngle: Math.atan2(vy, vx),
      impactPoint: { x: closestX, y: closestY }
    };
  }

  return {
    hit: false,
    sliceAngle: 0,
    impactPoint: { x: circle.x, y: circle.y }
  };
}

/**
 * Checks an array of connected trail points against a circle.
 * Tests consecutive segments from newest to oldest for immediate detection.
 */
export function checkTrailCircleCollision(
  points: readonly Point[],
  circle: Circle
): SliceIntersection {
  if (points.length < 2) {
    return { hit: false, sliceAngle: 0, impactPoint: { x: circle.x, y: circle.y } };
  }

  // Check from latest segment backwards
  for (let i = points.length - 1; i >= 1; i--) {
    const res = checkSegmentCircleCollision(points[i - 1], points[i], circle);
    if (res.hit) {
      return res;
    }
  }

  return { hit: false, sliceAngle: 0, impactPoint: { x: circle.x, y: circle.y } };
}
