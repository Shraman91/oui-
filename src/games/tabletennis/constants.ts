export const TABLE_TENNIS_CONSTANTS = {
  TABLE: {
    LENGTH: 9.0, // Z axis length (4.5 per side)
    WIDTH: 5.2,  // X axis width
    THICKNESS: 0.18,
    SURFACE_Y: 0.0,
    LEGS_HEIGHT: 2.4,
    NET_HEIGHT: 0.55,
    NET_OVERHANG: 0.4
  },
  BALL: {
    RADIUS: 0.13,
    GRAVITY: -14.5,
    RESTITUTION_TABLE: 0.86, // Bounciness on table surface
    RESTITUTION_NET: 0.25,   // Net dampening
    AIR_DRAG: 0.998,
    SPIN_FACTOR: 0.15
  },
  PADDLE: {
    RADIUS: 0.48,
    THICKNESS: 0.06,
    HANDLE_LENGTH: 0.38,
    PLAYER_Z: 4.8,
    AI_Z: -4.8,
    HIT_RANGE_Z: 0.65,
    HIT_RANGE_XY: 0.75,
    TRACKING_LERP: 18.0
  },
  PHYSICS: {
    MIN_HIT_SPEED: 7.5,
    BASE_SERVE_SPEED: 8.5,
    MAX_HIT_SPEED: 14.0
  },
  MATCH: {
    POINTS_TO_WIN: 11,
    WIN_BY_MARGIN: 2,
    SERVES_PER_TURN: 2
  },
  AI: {
    EASY: {
      reactionDelay: 0.28,
      trackingError: 0.55,
      speedMult: 0.85,
      missChance: 0.18
    },
    NORMAL: {
      reactionDelay: 0.16,
      trackingError: 0.30,
      speedMult: 1.0,
      missChance: 0.08
    },
    HARD: {
      reactionDelay: 0.06,
      trackingError: 0.12,
      speedMult: 1.25,
      missChance: 0.02
    }
  }
};
