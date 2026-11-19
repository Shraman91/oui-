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
  isServePhase: boolean;
}

export interface CollisionEvent {
  type: 'bounce_player' | 'bounce_ai' | 'bounce_out' | 'net_hit' | 'paddle_player' | 'paddle_ai';
  position: THREE.Vector3;
  normal?: THREE.Vector3;
}

export interface TrajectoryPrediction {
  interceptPoint: THREE.Vector3;
  timeToIntercept: number;
  willBounceTable: boolean;
  bouncePoint?: THREE.Vector3;
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
      timeInPlay: 0,
      isServePhase: true
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
    this.state.isServePhase = true;
    this.state.velocity.set(0, 0, 0);
    this.state.spin.set(0, 0, 0);

    const isPlayer = this.state.server === 'player';
    const sz = isPlayer ? 4.2 : -4.2;
    const sy = TABLE_TENNIS_CONSTANTS.TABLE.SURFACE_Y + 0.70;
    this.state.position.set(0.3 * (isPlayer ? 1 : -1), sy, sz);
    this.prevPosition.copy(this.state.position);
  }

  public executeServe(hitter: Hitter, targetX = 0, speedMult = 1.0): void {
    if (this.state.state !== 'serving') return;

    this.state.state = 'in_play';
    this.state.lastHitter = hitter;
    this.state.isServePhase = true;
    this.state.bouncesPlayerSide = 0;
    this.state.bouncesAiSide = 0;
    this.state.hasHitNet = false;
    this.state.timeInPlay = 0;

    const isPlayer = hitter === 'player';
    const dirZ = isPlayer ? -1 : 1;
    const speed = TABLE_TENNIS_CONSTANTS.PHYSICS.BASE_SERVE_SPEED * speedMult;

    // Firm forward and downward angle ensuring initial bounce on server table at |z| ~ 2.5m
    this.state.velocity.set(
      (targetX - this.state.position.x) * 0.75,
      -1.4,
      dirZ * speed
    );
  }

  public predictTrajectory(targetZ: number): TrajectoryPrediction | null {
    if (this.state.state !== 'in_play' && this.state.state !== 'serving') {
      return null;
    }

    const vz = this.state.velocity.z;
    if (Math.abs(vz) < 0.1) return null;

    // Moving away from targetZ
    if (targetZ < 0 && vz >= 0) return null;
    if (targetZ > 0 && vz <= 0) return null;

    const dt = 0.016;
    let simX = this.state.position.x;
    let simY = this.state.position.y;
    let simZ = this.state.position.z;
    let simVx = this.state.velocity.x;
    let simVy = this.state.velocity.y;
    let simVz = this.state.velocity.z;

    const tblW = TABLE_TENNIS_CONSTANTS.TABLE.WIDTH;
    const tblL = TABLE_TENNIS_CONSTANTS.TABLE.LENGTH;
    const tableTopY = TABLE_TENNIS_CONSTANTS.TABLE.SURFACE_Y;
    const ballR = TABLE_TENNIS_CONSTANTS.BALL.RADIUS;

    let willBounceTable = false;
    let bouncePoint: THREE.Vector3 | undefined;
    let totalTime = 0;

    const maxSteps = 120; // Up to ~2 seconds forward
    for (let step = 0; step < maxSteps; step++) {
      totalTime += dt;
      const prevY = simY;

      // Integrate physics
      simVy += TABLE_TENNIS_CONSTANTS.BALL.GRAVITY * dt;
      simVx *= TABLE_TENNIS_CONSTANTS.BALL.AIR_DRAG;
      simVz *= TABLE_TENNIS_CONSTANTS.BALL.AIR_DRAG;

      simX += simVx * dt;
      simY += simVy * dt;
      simZ += simVz * dt;

      // Check table bounce
      if (prevY >= tableTopY + ballR && simY <= tableTopY + ballR) {
        if (Math.abs(simX) <= tblW / 2 && Math.abs(simZ) <= tblL / 2) {
          simY = tableTopY + ballR;
          simVy = -simVy * TABLE_TENNIS_CONSTANTS.BALL.RESTITUTION_TABLE;
          willBounceTable = true;
          if (!bouncePoint) {
            bouncePoint = new THREE.Vector3(simX, simY, simZ);
          }
        }
      }

      // Check if target Z plane reached
      const reached = targetZ < 0 ? simZ <= targetZ : simZ >= targetZ;
      if (reached) {
        return {
          interceptPoint: new THREE.Vector3(simX, Math.max(0.2, simY), targetZ),
          timeToIntercept: totalTime,
          willBounceTable,
          bouncePoint
        };
      }

      // If fallen beneath arena, break
      if (simY < -2.0) {
        break;
      }
    }

    return {
      interceptPoint: new THREE.Vector3(simX, Math.max(0.3, simY), targetZ),
      timeToIntercept: totalTime,
      willBounceTable,
      bouncePoint
    };
  }

  public hitPaddle(
    hitter: Hitter,
    paddlePos: THREE.Vector3,
    swingSpeed = 1.0,
    swingDirX = 0,
    targetLanding?: { x: number; z: number }
  ): boolean {
    if (this.state.state !== 'in_play' && this.state.state !== 'serving') {
      return false;
    }

    const isPlayer = hitter === 'player';
    const hitZ = paddlePos.z;

    // Generous continuous hit range in Z (up to 1.2m window) and XY (up to 0.95m radius)
    const dz = Math.abs(this.state.position.z - hitZ);
    const dxy = Math.hypot(
      this.state.position.x - paddlePos.x,
      this.state.position.y - paddlePos.y
    );

    if (dz > 1.25 || dxy > 0.95) {
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
    this.state.isServePhase = false;
    this.state.bouncesPlayerSide = 0;
    this.state.bouncesAiSide = 0;
    this.state.hasHitNet = false;

    // Place ball cleanly in front of paddle to eliminate multiple frames of overlap
    if (isPlayer) {
      this.state.position.z = Math.min(this.state.position.z, hitZ - 0.25);
    } else {
      this.state.position.z = Math.max(this.state.position.z, hitZ + 0.25);
    }
    this.prevPosition.copy(this.state.position);

    const dirZ = isPlayer ? -1 : 1;
    const clampedSpeed = THREE.MathUtils.clamp(
      TABLE_TENNIS_CONSTANTS.PHYSICS.MIN_HIT_SPEED * (0.9 + swingSpeed * 0.35),
      TABLE_TENNIS_CONSTANTS.PHYSICS.MIN_HIT_SPEED,
      TABLE_TENNIS_CONSTANTS.PHYSICS.MAX_HIT_SPEED
    );

    if (targetLanding) {
      // Intelligent tactical return aimed at targetLanding
      const deltaZ = targetLanding.z - this.state.position.z;
      const vz = dirZ * clampedSpeed;
      const flightTime = Math.max(0.3, Math.abs(deltaZ / vz));
      const vx = (targetLanding.x - this.state.position.x) / flightTime;

      // Net crossing clearance calculation:
      const tNet = Math.max(0.1, Math.abs(this.state.position.z / vz));
      const g = TABLE_TENNIS_CONSTANTS.BALL.GRAVITY;
      // We want clearance over net top (0.55m) with safety margin (0.75m)
      const vyRequiredForNet = (0.75 - this.state.position.y - 0.5 * g * tNet * tNet) / tNet;
      // And landing on table (y = 0.13m) at flightTime
      const vyRequiredForLanding = (0.13 - this.state.position.y - 0.5 * g * flightTime * flightTime) / flightTime;

      const vy = Math.max(vyRequiredForNet, vyRequiredForLanding, 2.5);

      this.state.velocity.set(vx, vy, vz);
      this.state.spin.set((Math.random() - 0.5) * 2.0, 0, 0);
    } else {
      // Direct aim calculation based on paddle contact offset and swing
      const paddleOffsetX = (this.state.position.x - paddlePos.x) / TABLE_TENNIS_CONSTANTS.PADDLE.RADIUS;
      const vx = paddleOffsetX * 2.8 + swingDirX * 1.8;
      const vy = 3.6 + Math.max(0, -this.state.velocity.y * 0.25);
      const vz = dirZ * clampedSpeed;

      this.state.velocity.set(vx, vy, vz);
      this.state.spin.set(paddleOffsetX * 2.0, 0, 0);
    }

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
      } else if (this.state.position.y > tableTopY + netH) {
        // Cleared over net cleanly
        if (this.state.isServePhase) {
          this.state.isServePhase = false;
        }
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
        const isPlayerSide = z > 0;

        if (this.state.isServePhase) {
          // Serve phase: calibrate upward bounce arc (4.6 m/s) ensuring clean clearance over net
          this.state.velocity.y = 4.6;

          if (isPlayerSide) {
            this.state.bouncesPlayerSide++;
            onEvent?.({
              type: 'bounce_player',
              position: this.state.position.clone()
            });

            // If player was serving and bounced twice on player side before crossing net => Fault!
            if (this.state.server === 'player' && this.state.bouncesPlayerSide >= 2) {
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

            // If AI was serving and bounced twice on AI side before crossing net => Fault!
            if (this.state.server === 'ai' && this.state.bouncesAiSide >= 2) {
              this.state.state = 'point_awarded';
              return 'player';
            }
          }
        } else {
          // Regular rally after crossing net
          this.state.velocity.y =
            -this.state.velocity.y * TABLE_TENNIS_CONSTANTS.BALL.RESTITUTION_TABLE;

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

            // If player just hit it and it bounced on player's own side during rally => Fault!
            if (this.state.lastHitter === 'player') {
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

            // If AI just hit it and it bounced on AI's own side during rally => Fault!
            if (this.state.lastHitter === 'ai') {
              this.state.state = 'point_awarded';
              return 'player';
            }
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
