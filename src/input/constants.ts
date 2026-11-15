export const INPUT_CONSTANTS = {
  // Mouse provider settings
  MOUSE: {
    // Pointer smoothing (1.0 = instant raw, 0.4 = responsive smoothing)
    POINTER_ALPHA: 0.85,
    // Swing detection speed threshold in normalized screen units per second
    SWING_SPEED_THRESHOLD: 2.2,
    // Minimum duration (ms) between consecutive swing event triggers
    SWING_COOLDOWN_MS: 300,
    // Tilt interpolation rate per second using keyboard WASD/arrows
    TILT_LERP_SPEED: 8.0
  },
  // Hand tracking (MediaPipe) settings (Phase 7)
  HAND: {
    POINTER_ALPHA: 0.3,
    PINCH_THRESHOLD: 0.05,
    SWING_SPEED_THRESHOLD: 2.0,
    SWING_COOLDOWN_MS: 300
  },
  // Phone controller settings (Phase 8)
  PHONE: {
    ACCEL_LOW_PASS_ALPHA: 0.25,
    SWING_THRESHOLD_G: 2.5,
    SWING_COOLDOWN_MS: 300
  }
} as const;
