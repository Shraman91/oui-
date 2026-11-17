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
 * Returns hit boolean, slice angle (radians), and impact point on the circle.
 */
export function checkSegmentCircleCollision(
  p1: Point,
  p2: Point,
  circle: Circle
): SliceIntersection {
  const vx = p2.x - p1.x;
  const vy = p2.y - p1.y;
  const wx = circle.x - p1.x;
  const wy = circle.y - p1.y;

  const lenSq = vx * vx + vy * vy;
  let t = 0;

  if (lenSq > 0.000001) {
    t = (wx * vx + wy * vy) / lenSq;
  }

  // Clamp t to segment bounds [0, 1]
  const clampedT = Math.max(0, Math.min(1, t));

  // Closest point on the segment
  const closestX = p1.x + clampedT * vx;
  const closestY = p1.y + clampedT * vy;

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distSq = dx * dx + dy * dy;

  const radiusSq = circle.radius * circle.radius;

  if (distSq <= radiusSq) {
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
