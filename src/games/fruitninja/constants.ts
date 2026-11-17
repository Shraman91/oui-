export interface FruitConfig {
  id: string;
  name: string;
  radius: number;
  points: number;
  skinColor: string;
  fleshColor: string;
  rindColor?: string;
  juiceColor: string;
}

export const FRUIT_NINJA_CONSTANTS = {
  CANVAS: {
    WIDTH: 1280,
    HEIGHT: 720
  },
  PHYSICS: {
    GRAVITY: 780, // pixels/sec^2
    MIN_LAUNCH_VY: -780,
    MAX_LAUNCH_VY: -960,
    MIN_LAUNCH_VX: -180,
    MAX_LAUNCH_VX: 180,
    ROTATION_SPEED_MIN: -3.5,
    ROTATION_SPEED_MAX: 3.5,
    SPLIT_OUTWARD_SPEED: 160
  },
  GAMEPLAY: {
    MAX_MISSES: 3,
    SPAWN_INTERVAL_INITIAL: 2.2, // seconds
    SPAWN_INTERVAL_MIN: 0.85,
    BOMB_SPAWN_CHANCE: 0.16,
    COMBO_WINDOW_SECONDS: 0.35,
    MIN_SLICE_SPEED: 0.25 // normalized units per second
  },
  BLADE: {
    TRAIL_LIFETIME_SECONDS: 0.22,
    COLOR: '#f472b6', // Cute baby-pink blade
    CORE_COLOR: '#ffffff',
    BASE_WIDTH: 7
  },
  FRUITS: [
    {
      id: 'watermelon',
      name: 'Watermelon',
      radius: 36,
      points: 1,
      skinColor: '#15803d',
      rindColor: '#86efac',
      fleshColor: '#f43f5e',
      juiceColor: '#fb7185'
    },
    {
      id: 'orange',
      name: 'Orange',
      radius: 30,
      points: 1,
      skinColor: '#ea580c',
      rindColor: '#fdba74',
      fleshColor: '#fb923c',
      juiceColor: '#fed7aa'
    },
    {
      id: 'apple',
      name: 'Apple',
      radius: 28,
      points: 1,
      skinColor: '#dc2626',
      rindColor: '#fecaca',
      fleshColor: '#fef08a',
      juiceColor: '#f87171'
    },
    {
      id: 'kiwi',
      name: 'Kiwi',
      radius: 26,
      points: 2,
      skinColor: '#78350f',
      rindColor: '#bbf7d0',
      fleshColor: '#4ade80',
      juiceColor: '#86efac'
    },
    {
      id: 'dragonfruit',
      name: 'Dragonfruit',
      radius: 34,
      points: 3,
      skinColor: '#db2777',
      rindColor: '#fbcfe8',
      fleshColor: '#ffffff',
      juiceColor: '#f472b6'
    }
  ] as const satisfies readonly FruitConfig[],
  BOMB: {
    id: 'bomb',
    radius: 32,
    bodyColor: '#3b1d28',
    fuseColor: '#fde047',
    sparkColor: '#f43f5e'
  }
} as const;
