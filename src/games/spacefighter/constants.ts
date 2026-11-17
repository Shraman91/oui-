export const SPACE_FIGHTER_CONSTANTS = {
  CANVAS: {
    WIDTH: 1280,
    HEIGHT: 720
  },
  PLAYER: {
    INITIAL_LIVES: 3,
    SPEED_MAX: 520, // px/s
    TILT_SENSITIVITY: 620, // px/s per unit tilt
    POINTER_LERP: 12.0, // lerp factor for mouse/hand pointer tracking
    FIRE_COOLDOWN_SECONDS: 0.14, // ~7 shots per second
    INVULNERABILITY_SECONDS: 2.0,
    HITBOX_RADIUS: 18,
    BOUNDS_PADDING: 36
  },
  BULLETS: {
    PLAYER_SPEED: -780, // upward
    ENEMY_SPEED: 380, // downward
    POOL_SIZE_PLAYER: 60,
    POOL_SIZE_ENEMY: 50,
    RADIUS_PLAYER: 6,
    RADIUS_ENEMY: 7
  },
  ENEMIES: {
    POOL_SIZE: 35,
    TYPES: {
      SCOUT: {
        id: 'scout',
        name: 'Swooper Scout',
        health: 1,
        points: 100,
        speedY: 180,
        frequency: 2.8,
        amplitude: 140,
        radius: 20
      },
      BOMBER: {
        id: 'bomber',
        name: 'Dive Bomber',
        health: 2,
        points: 200,
        speedY: 260,
        chargeSpeed: 440,
        radius: 22
      },
      CRUISER: {
        id: 'cruiser',
        name: 'Cruiser',
        health: 4,
        points: 350,
        speedY: 110,
        fireInterval: 1.8,
        radius: 28
      }
    }
  },
  BOSS: {
    WAVE_INTERVAL: 5, // Every 5 waves
    BASE_HEALTH: 45,
    HEALTH_PER_CYCLE: 25,
    SPEED_X: 180,
    POINTS: 2500,
    RADIUS: 56,
    ATTACK_COOLDOWN: 1.2
  },
  STARFIELD: {
    LAYER_1_COUNT: 45,
    LAYER_1_SPEED: 35,
    LAYER_2_COUNT: 30,
    LAYER_2_SPEED: 85,
    LAYER_3_COUNT: 18,
    LAYER_3_SPEED: 160
  }
};
