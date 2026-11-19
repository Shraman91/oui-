import * as THREE from 'three';
import { TABLE_TENNIS_CONSTANTS } from './constants';

export type Hitter = 'player' | 'ai';
export type BallState = 'serving' | 'in_play' | 'point_awarded';

export interface BallPhysicsState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  state: BallState;
  lastHitter: Hitter | null;
  server: Hitter;
  bouncesPlayerSide: number;
  bouncesAiSide: number;
  hasHitNet: boolean;
  timeInPlay: number;
}

export interface CollisionEvent {
  type: 'bounce_player' | 'bounce_ai' | 'bounce_out' | 'net_hit' | 'paddle_player' | 'paddle_ai';
  position: THREE.Vector3;
  normal?: THREE.Vector3;
}

export class TableTennisPhysics {
  private state: BallPhysicsState;
  private prevPosition = new THREE.Vector3();

  constructor() {
    this.state = {
      position: new THREE.Vector3(0, 1.2, 4.2),
      velocity: new THREE.Vector3(0, 0, 0),
      spin: new THREE.Vector3(0, 0, 0),
      state: 'serving',
      lastHitter: null,
      server: 'player',
      bouncesPlayerSide: 0,
      bouncesAiSide: 0,
      hasHitNet: false,
      timeInPlay: 0
    };
  }

  public getState(): Readonly<BallPhysicsState> {
    return this.state;
  }

  public setServer(server: Hitter): void {
    this.state.server = server;
    this.resetForServe();
  }

  public resetForServe(): void {
    this.state.state = 'serving';
    this.state.lastHitter = null;
    this.state.bouncesPlayerSide = 0;
    this.state.bouncesAiSide = 0;
    this.state.hasHitNet = false;
    this.state.timeInPlay = 0;
    this.state.velocity.set(0, 0, 0);
    this.state.spin.set(0, 0, 0);

    const isPlayer = this.state.server === 'player';
    const sz = isPlayer ? 4.3 : -4.3;
    const sy = TABLE_TENNIS_CONSTANTS.TABLE.SURFACE_Y + 0.65;
    this.state.position.set(0.4 * (isPlayer ? 1 : -1), sy, sz);
    this.prevPosition.copy(this.state.position);
  }

  public executeServe(hitter: Hitter, targetX = 0, speedMult = 1.0): void {
    if (this.state.state !== 'serving') return;

    this.state.state = 'in_play';
    this.state.lastHitter = hitter;
    this.state.bouncesPlayerSide = 0;
    this.state.bouncesAiSide = 0;
    this.state.hasHitNet = false;

    const isPlayer = hitter === 'player';
    const dirZ = isPlayer ? -1 : 1;
    const speed = TABLE_TENNIS_CONSTANTS.PHYSICS.BASE_SERVE_SPEED * speedMult;

    // Arc forward and bounce first on server's table, then cross net
    this.state.velocity.set(
      (targetX - this.state.position.x) * 0.9,
      1.8,
      dirZ * speed
    );
  }

  public hitPaddle(
    hitter: Hitter,
    paddlePos: THREE.Vector3,
    swingSpeed = 1.0,
    swingDirX = 0
  ): boolean {
    if (this.state.state !== 'in_play' && this.state.state !== 'serving') {
      return false;
    }

    const isPlayer = hitter === 'player';
    const hitZ = isPlayer ? TABLE_TENNIS_CONSTANTS.PADDLE.PLAYER_Z : TABLE_TENNIS_CONSTANTS.PADDLE.AI_Z;

    // Check hit range distance
    const dz = Math.abs(this.state.position.z - hitZ);
    const dxy = Math.hypot(
      this.state.position.x - paddlePos.x,
      this.state.position.y - paddlePos.y
    );

    if (
      dz > TABLE_TENNIS_CONSTANTS.PADDLE.HIT_RANGE_Z ||
      dxy > TABLE_TENNIS_CONSTANTS.PADDLE.HIT_RANGE_XY
    ) {
      return false;
    }

    // Ball was in serving state: serve it!
    if (this.state.state === 'serving') {
      this.executeServe(hitter, swingDirX * 1.5, swingSpeed);
      return true;
    }

    // Must be moving towards hitter to hit
    if (isPlayer && this.state.velocity.z <= 0) return false;
    if (!isPlayer && this.state.velocity.z >= 0) return false;

    // Execute standard hit
    this.state.lastHitter = hitter;
    this.state.bouncesPlayerSide = 0;
    this.state.bouncesAiSide = 0;
    this.state.hasHitNet = false;

    const dirZ = isPlayer ? -1 : 1;
    const clampedSpeed = THREE.MathUtils.clamp(
      TABLE_TENNIS_CONSTANTS.PHYSICS.MIN_HIT_SPEED * (0.9 + swingSpeed * 0.35),
      TABLE_TENNIS_CONSTANTS.PHYSICS.MIN_HIT_SPEED,
      TABLE_TENNIS_CONSTANTS.PHYSICS.MAX_HIT_SPEED
    );

    // Aim calculation: offset from paddle center creates angle
    const paddleOffsetX = (this.state.position.x - paddlePos.x) / TABLE_TENNIS_CONSTANTS.PADDLE.RADIUS;
    const vx = paddleOffsetX * 2.8 + swingDirX * 1.8;

    // Upward arc ensuring clearance over the net (0.55m)
    const vy = 3.6 + Math.max(0, -this.state.velocity.y * 0.25);
    const vz = dirZ * clampedSpeed;

    this.state.velocity.set(vx, vy, vz);
    this.state.spin.set(paddleOffsetX * 2.0, 0, 0);

    return true;
  }

  public update(dt: number, onEvent?: (event: CollisionEvent) => void): Hitter | null {
    if (this.state.state !== 'in_play') {
      return null;
    }

    this.state.timeInPlay += dt;
    this.prevPosition.copy(this.state.position);

    // 1. Gravity and Air Drag
    this.state.velocity.y += TABLE_TENNIS_CONSTANTS.BALL.GRAVITY * dt;
    this.state.velocity.x *= TABLE_TENNIS_CONSTANTS.BALL.AIR_DRAG;
    this.state.velocity.z *= TABLE_TENNIS_CONSTANTS.BALL.AIR_DRAG;

    // Spin magnus effect (deflection from spin)
    this.state.velocity.x += this.state.spin.x * dt * TABLE_TENNIS_CONSTANTS.BALL.SPIN_FACTOR;

    // Position integration
    this.state.position.addScaledVector(this.state.velocity, dt);

    const tblW = TABLE_TENNIS_CONSTANTS.TABLE.WIDTH;
    const tblL = TABLE_TENNIS_CONSTANTS.TABLE.LENGTH;
    const tableTopY = TABLE_TENNIS_CONSTANTS.TABLE.SURFACE_Y;
    const ballR = TABLE_TENNIS_CONSTANTS.BALL.RADIUS;

    // 2. Net Collision
    // Check if ball swept through Z = 0
    if (
      (this.prevPosition.z > 0 && this.state.position.z <= 0) ||
      (this.prevPosition.z < 0 && this.state.position.z >= 0)
    ) {
      const netHalfW = (tblW + TABLE_TENNIS_CONSTANTS.TABLE.NET_OVERHANG) / 2;
      const netH = TABLE_TENNIS_CONSTANTS.TABLE.NET_HEIGHT;

      if (
        Math.abs(this.state.position.x) <= netHalfW &&
        this.state.position.y <= tableTopY + netH &&
        this.state.position.y >= tableTopY
      ) {
        // Hit the net!
        this.state.hasHitNet = true;
        this.state.velocity.z = -this.state.velocity.z * TABLE_TENNIS_CONSTANTS.BALL.RESTITUTION_NET;
        this.state.velocity.y *= 0.4;
        this.state.position.z = this.prevPosition.z;

        onEvent?.({
          type: 'net_hit',
          position: this.state.position.clone()
        });
      }
    }

    // 3. Table Surface Collision (Y = tableTopY + ballR)
    if (
      this.prevPosition.y >= tableTopY + ballR &&
      this.state.position.y <= tableTopY + ballR
    ) {
      const inX = Math.abs(this.state.position.x) <= tblW / 2;
      const z = this.state.position.z;

      if (inX && Math.abs(z) <= tblL / 2) {
        // Table hit!
        this.state.position.y = tableTopY + ballR;
        this.state.velocity.y =
          -this.state.velocity.y * TABLE_TENNIS_CONSTANTS.BALL.RESTITUTION_TABLE;

        const isPlayerSide = z > 0;

        if (isPlayerSide) {
          this.state.bouncesPlayerSide++;
          onEvent?.({
            type: 'bounce_player',
            position: this.state.position.clone()
          });

          // Check for 2nd bounce on player's side => AI point!
          if (this.state.bouncesPlayerSide >= 2) {
            this.state.state = 'point_awarded';
            return 'ai';
          }

          // If player just hit it and it bounced on player's own side during normal rally (not serving) => point to AI
          if (this.state.lastHitter === 'player' && this.state.timeInPlay > 0.4) {
            this.state.state = 'point_awarded';
            return 'ai';
          }
        } else {
          // AI side
          this.state.bouncesAiSide++;
          onEvent?.({
            type: 'bounce_ai',
            position: this.state.position.clone()
          });

          // 2nd bounce on AI side => Player point!
          if (this.state.bouncesAiSide >= 2) {
            this.state.state = 'point_awarded';
            return 'player';
          }

          // If AI just hit it and it bounced on AI's own side during rally => point to Player
          if (this.state.lastHitter === 'ai' && this.state.timeInPlay > 0.4) {
            this.state.state = 'point_awarded';
            return 'player';
          }
        }
      }
    }

    // 4. Floor / Out of bounds check (Y < -2.2)
    if (this.state.position.y < -2.2) {
      this.state.state = 'point_awarded';

      onEvent?.({
        type: 'bounce_out',
        position: this.state.position.clone()
      });

      // Normal rally scoring determination:
      if (this.state.lastHitter === 'player') {
        // Player hit the ball: Did it bounce on AI's side yet?
        if (this.state.bouncesAiSide >= 1) {
          // It bounced on AI side and went out => Player scores!
          return 'player';
        } else {
          // Player hit it out without bouncing on AI side => AI scores!
          return 'ai';
        }
      } else if (this.state.lastHitter === 'ai') {
        // AI hit the ball: Did it bounce on Player's side yet?
        if (this.state.bouncesPlayerSide >= 1) {
          // It bounced on Player's side and went out => AI scores!
          return 'ai';
        } else {
          // AI hit it out without bouncing on Player's side => Player scores!
          return 'player';
        }
      } else {
        // Nobody hit it properly: award to non-server
        return this.state.server === 'player' ? 'ai' : 'player';
      }
    }

    return null;
  }
}
