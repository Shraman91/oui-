import './tabletennis.css';
import * as THREE from 'three';
import { Game } from '../../core/Game';
import { InputManager, SwingEventPayload } from '../../input/InputManager';
import { TABLE_TENNIS_CONSTANTS } from './constants';
import { TableTennisPhysics, CollisionEvent, Hitter } from './physics';
import { TableTennisScene } from './TableTennisScene';
import { StorageManager } from '../../shared/storage';

type Difficulty = 'EASY' | 'NORMAL' | 'HARD';

export class TableTennisGame implements Game {
  public readonly id = 'tabletennis';
  public readonly title = 'Table Tennis';

  private container: HTMLElement | null = null;
  private inputManager: InputManager | null = null;
  private rootElement: HTMLElement | null = null;

  private scene: TableTennisScene | null = null;
  private physics: TableTennisPhysics = new TableTennisPhysics();

  // Match state
  private playerScore = 0;
  private aiScore = 0;
  private currentDifficulty: Difficulty = 'NORMAL';
  private isMatchOver = false;
  private isPaused = false;
  private pointCooldownTimer = 0;

  // AI Tracking state
  private aiTarget = new THREE.Vector3(0, 0.6, TABLE_TENNIS_CONSTANTS.PADDLE.AI_Z);
  private aiReactionTimer = 0;
  private aiErrorOffset = new THREE.Vector2(0, 0);

  // Player input tracking
  private playerTarget = new THREE.Vector3(0, 0.6, TABLE_TENNIS_CONSTANTS.PADDLE.PLAYER_Z);

  // Subscriptions
  private unsubSwing?: () => void;
  private unsubPressA?: () => void;

  // DOM Elements
  private scoreTextP1!: HTMLElement;
  private scoreTextAi!: HTMLElement;
  private statusPill!: HTMLElement;
  private diffBtn!: HTMLElement;
  private servePrompt!: HTMLElement;
  private pointBanner!: HTMLElement;
  private modalBackdrop!: HTMLElement;
  private modalTitle!: HTMLElement;
  private modalScore!: HTMLElement;

  public init(container: HTMLElement, inputManager: InputManager): void {
    this.container = container;
    this.inputManager = inputManager;

    this.rootElement = document.createElement('div');
    this.rootElement.className = 'oui-tt-wrapper';

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'oui-tt-canvas-container';
    this.rootElement.appendChild(canvasContainer);

    this.renderHUD();
    this.container.appendChild(this.rootElement);

    // Initialize 3D Scene
    this.scene = new TableTennisScene(canvasContainer);

    // Setup Input Subscriptions
    this.setupInput();

    // Start First Match
    this.resetMatch();
  }

  private renderHUD(): void {
    if (!this.rootElement) return;

    // HUD Header
    const hud = document.createElement('div');
    hud.className = 'oui-tt-hud';
    hud.innerHTML = `
      <!-- Scoreboard Pill -->
      <div class="oui-tt-hud-pill">
        <span class="oui-tt-player-score" id="tt-p1-score">P1: 0</span>
        <span class="oui-tt-score-divider">&bull;</span>
        <span class="oui-tt-ai-score" id="tt-ai-score">CPU: 0</span>
      </div>

      <!-- Center Status & Difficulty Pill -->
      <div class="oui-tt-center-hud">
        <div class="oui-tt-status-pill" id="tt-status-pill">P1 SERVE</div>
        <button class="oui-tt-diff-btn" id="tt-diff-btn" title="Toggle Difficulty">AI: NORMAL</button>
      </div>

      <!-- Target Info Pill -->
      <div class="oui-tt-hud-pill">
        <span style="font-family:'Comfortaa', sans-serif; font-size:0.86rem; font-weight:700; color:#382c33;">
          FIRST TO 11 (WIN BY 2)
        </span>
      </div>
    `;
    this.rootElement.appendChild(hud);

    this.scoreTextP1 = hud.querySelector('#tt-p1-score')!;
    this.scoreTextAi = hud.querySelector('#tt-ai-score')!;
    this.statusPill = hud.querySelector('#tt-status-pill')!;
    this.diffBtn = hud.querySelector('#tt-diff-btn')!;

    this.diffBtn.addEventListener('click', () => {
      this.cycleDifficulty();
    });

    // Serve Prompt
    this.servePrompt = document.createElement('div');
    this.servePrompt.className = 'oui-tt-serve-prompt';
    this.servePrompt.innerHTML = `
      <span>🏓</span>
      <span>SWING or [Button A] to Serve</span>
    `;
    this.rootElement.appendChild(this.servePrompt);

    // Point Awarded Popup
    this.pointBanner = document.createElement('div');
    this.pointBanner.className = 'oui-tt-point-banner';
    this.rootElement.appendChild(this.pointBanner);

    // Match Over Modal
    this.modalBackdrop = document.createElement('div');
    this.modalBackdrop.className = 'oui-tt-modal-backdrop';
    this.modalBackdrop.innerHTML = `
      <div class="oui-tt-modal-card">
        <h2 class="oui-tt-modal-title" id="tt-modal-title">MATCH WON!</h2>
        <div class="oui-tt-modal-score" id="tt-modal-score">FINAL: 11 - 9</div>
        <button class="oui-tt-modal-btn" id="tt-modal-restart-btn">PLAY AGAIN</button>
      </div>
    `;
    this.rootElement.appendChild(this.modalBackdrop);

    this.modalTitle = this.modalBackdrop.querySelector('#tt-modal-title')!;
    this.modalScore = this.modalBackdrop.querySelector('#tt-modal-score')!;
    const restartBtn = this.modalBackdrop.querySelector('#tt-modal-restart-btn')!;
    restartBtn.addEventListener('click', () => {
      this.resetMatch();
    });
  }

  private cycleDifficulty(): void {
    if (this.currentDifficulty === 'EASY') {
      this.currentDifficulty = 'NORMAL';
    } else if (this.currentDifficulty === 'NORMAL') {
      this.currentDifficulty = 'HARD';
    } else {
      this.currentDifficulty = 'EASY';
    }
    this.diffBtn.textContent = `AI: ${this.currentDifficulty}`;
  }

  private setupInput(): void {
    if (!this.inputManager) return;

    // Handle Swing events (Wiimote motion / fast mouse flick)
    this.unsubSwing = this.inputManager.on('swing', (payload: SwingEventPayload) => {
      if (this.isPaused || this.isMatchOver) return;
      this.handlePlayerSwing(payload.speed, payload.direction.x);
    });

    // Handle Button A presses (Serving / Deflecting / Modal restart)
    this.unsubPressA = this.inputManager.on('pressA', () => {
      if (this.isMatchOver) {
        this.resetMatch();
        return;
      }
      if (this.isPaused) return;

      const state = this.physics.getState();
      if (state.state === 'serving' && state.server === 'player') {
        this.physics.executeServe('player', 0, 1.0);
        this.scene?.spawnSparks(this.playerTarget, 0xfb7185, 8);
        this.updateHUD();
      } else {
        // Try hitting ball if in range
        this.handlePlayerSwing(1.2, 0);
      }
    });
  }

  private handlePlayerSwing(speed: number, dirX: number): void {
    const didHit = this.physics.hitPaddle('player', this.playerTarget, speed, dirX);
    if (didHit) {
      this.scene?.spawnSparks(this.playerTarget, 0xfb7185, 12);
      this.updateHUD();
    }
  }

  private resetMatch(): void {
    this.playerScore = 0;
    this.aiScore = 0;
    this.isMatchOver = false;
    this.pointCooldownTimer = 0;
    this.modalBackdrop.classList.remove('open');
    this.physics.setServer('player');
    this.updateHUD();
  }

  private resetForNextPoint(): void {
    // Standard table tennis serve alternating rules:
    const totalPoints = this.playerScore + this.aiScore;
    let nextServer: Hitter = 'player';

    if (this.playerScore >= 10 && this.aiScore >= 10) {
      // Deuce: alternate serve every single point
      nextServer = totalPoints % 2 === 0 ? 'player' : 'ai';
    } else {
      // Normal: alternate serve every 2 points
      nextServer = Math.floor(totalPoints / 2) % 2 === 0 ? 'player' : 'ai';
    }

    this.physics.setServer(nextServer);
    this.updateHUD();

    // If AI is serving, trigger AI serve after a brief pause
    if (nextServer === 'ai') {
      setTimeout(() => {
        if (!this.isMatchOver && !this.isPaused && this.physics.getState().state === 'serving') {
          this.executeAiServe();
        }
      }, 1000);
    }
  }

  private executeAiServe(): void {
    const config = TABLE_TENNIS_CONSTANTS.AI[this.currentDifficulty];
    let targetX = 0;

    if (this.currentDifficulty === 'EASY') {
      // Gentle center serve
      targetX = (Math.random() - 0.5) * 1.2;
    } else if (this.currentDifficulty === 'NORMAL') {
      // Alternates left and right sides
      targetX = (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.8);
    } else {
      // Hard: Deceptive wide cross-court or sharp corner serve
      targetX = (Math.random() > 0.5 ? 1 : -1) * (1.3 + Math.random() * 0.8);
    }

    this.physics.executeServe('ai', targetX, config.powerMult);
    this.scene?.spawnSparks(this.aiTarget, 0xf472b6, 8);
    this.updateHUD();
  }

  public update(dt: number): void {
    if (this.isPaused || !this.inputManager) return;

    // 1. Update Player Paddle Target from InputManager Pointer
    const state = this.inputManager.getState();
    const tblW = TABLE_TENNIS_CONSTANTS.TABLE.WIDTH;

    // Mapped horizontal and vertical reach
    this.playerTarget.x = (state.pointer.x - 0.5) * (tblW + 1.2);
    this.playerTarget.y = 0.2 + (1.0 - state.pointer.y) * 2.2;
    this.playerTarget.z = TABLE_TENNIS_CONSTANTS.PADDLE.PLAYER_Z;

    // Auto-deflection check when paddle is placed directly in ball path
    const ball = this.physics.getState();
    if (
      ball.state === 'in_play' &&
      ball.velocity.z > 0 &&
      Math.abs(ball.position.z - this.playerTarget.z) < 0.35 &&
      Math.hypot(ball.position.x - this.playerTarget.x, ball.position.y - this.playerTarget.y) < 0.45
    ) {
      this.handlePlayerSwing(0.9, (ball.position.x - this.playerTarget.x) * 1.5);
    }

    // 2. Handle Point Cooldown Transition
    if (this.pointCooldownTimer > 0) {
      this.pointCooldownTimer -= dt;
      if (this.pointCooldownTimer <= 0) {
        this.hidePointBanner();
        if (!this.isMatchOver) {
          this.resetForNextPoint();
        }
      }
    } else if (!this.isMatchOver) {
      // 3. AI Opponent Logic
      this.updateAi(dt);

      // 4. Update Physics Simulation
      const pointWinner = this.physics.update(dt, (event: CollisionEvent) => {
        this.handleCollisionEvent(event);
      });

      if (pointWinner) {
        this.awardPoint(pointWinner);
      }
    }

    // 5. Update 3D Visuals
    this.scene?.updateVisuals(
      this.physics,
      this.playerTarget.x,
      this.playerTarget.y,
      this.aiTarget.x,
      this.aiTarget.y,
      dt
    );
  }

  private updateAi(dt: number): void {
    const ball = this.physics.getState();
    const config = TABLE_TENNIS_CONSTANTS.AI[this.currentDifficulty];

    // If ball is heading toward AI (velocity.z < 0)
    if (ball.state === 'in_play' && ball.velocity.z < 0) {
      this.aiReactionTimer += dt;

      if (this.aiReactionTimer >= config.reactionDelay) {
        // High-precision trajectory prediction with physics and bounce modeling
        const prediction = this.physics.predictTrajectory(TABLE_TENNIS_CONSTANTS.PADDLE.AI_Z);

        let targetX = 0;
        let targetY = 0.6;

        if (prediction) {
          targetX = prediction.interceptPoint.x + this.aiErrorOffset.x;
          targetY = prediction.interceptPoint.y + this.aiErrorOffset.y;
        } else {
          // Fallback project
          const timeToReach = Math.max(0.01, (ball.position.z - TABLE_TENNIS_CONSTANTS.PADDLE.AI_Z) / -ball.velocity.z);
          targetX = ball.position.x + ball.velocity.x * timeToReach + this.aiErrorOffset.x;
          targetY = Math.max(0.35, ball.position.y + ball.velocity.y * timeToReach) + this.aiErrorOffset.y;
        }

        // Clamp AI reach to reasonable limits around the table
        targetX = THREE.MathUtils.clamp(targetX, -TABLE_TENNIS_CONSTANTS.TABLE.WIDTH / 2 - 0.7, TABLE_TENNIS_CONSTANTS.TABLE.WIDTH / 2 + 0.7);
        targetY = THREE.MathUtils.clamp(targetY, 0.15, 2.2);

        const lerpSpeed = Math.min(1.0, 11.0 * config.speedMult * dt);
        this.aiTarget.x += (targetX - this.aiTarget.x) * lerpSpeed;
        this.aiTarget.y += (targetY - this.aiTarget.y) * lerpSpeed;

        // Check if ball is in AI hit zone
        const distZ = Math.abs(ball.position.z - TABLE_TENNIS_CONSTANTS.PADDLE.AI_Z);
        const distXY = Math.hypot(ball.position.x - this.aiTarget.x, ball.position.y - this.aiTarget.y);

        if (distZ < 0.48 && distXY < 0.70) {
          // Check miss chance
          const willMiss = Math.random() < config.missChance;
          if (!willMiss) {
            // Intelligent tactical placement: counter the player's position
            let landingX = 0;
            const useCornerTactic = Math.random() < config.cornerTactics;

            if (useCornerTactic) {
              // If player is on left, drive right; if player on right, drive left
              if (this.playerTarget.x < -0.3) {
                landingX = 1.0 + Math.random() * 0.9; // Target right side
              } else if (this.playerTarget.x > 0.3) {
                landingX = -1.0 - Math.random() * 0.9; // Target left side
              } else {
                landingX = (Math.random() > 0.5 ? 1 : -1) * (1.1 + Math.random() * 0.7);
              }
            } else {
              // Normal return near center
              landingX = (Math.random() - 0.5) * 1.5;
            }

            // Target landing depth on player's side of the table (Z in [1.5, 3.8])
            const landingZ = 1.8 + Math.random() * 1.8;

            const didHit = this.physics.hitPaddle(
              'ai',
              this.aiTarget,
              config.powerMult,
              (landingX - this.aiTarget.x) * 0.4,
              { x: landingX, z: landingZ }
            );

            if (didHit) {
              this.scene?.spawnSparks(this.aiTarget, 0xf472b6, 10);
              this.aiReactionTimer = 0;
              // Reset error offset for next rally stroke
              this.aiErrorOffset.set(
                (Math.random() - 0.5) * config.trackingError,
                (Math.random() - 0.5) * (config.trackingError * 0.5)
              );
            }
          }
        }
      }
    } else {
      // Ball moving toward player: return gently to center ready stance
      this.aiReactionTimer = 0;
      this.aiTarget.x += (0 - this.aiTarget.x) * 4.5 * dt;
      this.aiTarget.y += (0.65 - this.aiTarget.y) * 4.5 * dt;
    }
  }

  private handleCollisionEvent(event: CollisionEvent): void {
    if (!this.scene) return;

    if (event.type === 'bounce_player') {
      this.scene.spawnSparks(event.position, 0x0284c7, 6);
    } else if (event.type === 'bounce_ai') {
      this.scene.spawnSparks(event.position, 0x0284c7, 6);
    } else if (event.type === 'net_hit') {
      this.scene.spawnSparks(event.position, 0xffffff, 8);
    }
  }

  private awardPoint(winner: Hitter): void {
    if (winner === 'player') {
      this.playerScore++;
      this.showPointBanner('POINT TO P1!', '#fb7185');
    } else {
      this.aiScore++;
      this.showPointBanner('POINT TO CPU!', '#a855f7');
    }

    this.updateHUD();
    this.pointCooldownTimer = 1.6;

    // Check match victory (first to 11, win by 2)
    const pointsToWin = TABLE_TENNIS_CONSTANTS.MATCH.POINTS_TO_WIN;
    const margin = TABLE_TENNIS_CONSTANTS.MATCH.WIN_BY_MARGIN;

    if (this.playerScore >= pointsToWin && this.playerScore - this.aiScore >= margin) {
      this.endMatch('player');
    } else if (this.aiScore >= pointsToWin && this.aiScore - this.playerScore >= margin) {
      this.endMatch('ai');
    }
  }

  private showPointBanner(text: string, color: string): void {
    this.pointBanner.textContent = text;
    this.pointBanner.style.color = color;
    this.pointBanner.classList.add('show');
  }

  private hidePointBanner(): void {
    this.pointBanner.classList.remove('show');
  }

  private endMatch(winner: Hitter): void {
    this.isMatchOver = true;

    // Save wins to storage
    if (winner === 'player') {
      const wins = StorageManager.getHighScore('tabletennis') + 1;
      StorageManager.saveHighScore('tabletennis', wins);
      this.modalTitle.textContent = 'MATCH WON!';
      this.modalTitle.style.color = '#15803d';
    } else {
      this.modalTitle.textContent = 'MATCH LOST!';
      this.modalTitle.style.color = '#e11d48';
    }

    this.modalScore.textContent = `FINAL SCORE: ${this.playerScore} - ${this.aiScore}`;
    this.modalBackdrop.classList.add('open');
  }

  private updateHUD(): void {
    this.scoreTextP1.textContent = `P1: ${this.playerScore}`;
    this.scoreTextAi.textContent = `CPU: ${this.aiScore}`;

    const ball = this.physics.getState();

    // Status pill
    if (this.playerScore >= 10 && this.aiScore >= 10) {
      if (this.playerScore === this.aiScore) {
        this.statusPill.textContent = 'DEUCE';
      } else if (this.playerScore > this.aiScore) {
        this.statusPill.textContent = 'MATCH POINT (P1)';
      } else {
        this.statusPill.textContent = 'MATCH POINT (CPU)';
      }
    } else if (this.playerScore >= 10 && this.playerScore > this.aiScore) {
      this.statusPill.textContent = 'MATCH POINT (P1)';
    } else if (this.aiScore >= 10 && this.aiScore > this.playerScore) {
      this.statusPill.textContent = 'MATCH POINT (CPU)';
    } else {
      this.statusPill.textContent = ball.server === 'player' ? 'P1 SERVE' : 'CPU SERVE';
    }

    // Serve prompt visibility
    if (ball.state === 'serving' && ball.server === 'player') {
      this.servePrompt.style.display = 'flex';
    } else {
      this.servePrompt.style.display = 'none';
    }
  }

  public render(): void {
    this.scene?.render();
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public destroy(): void {
    this.unsubSwing?.();
    this.unsubPressA?.();

    this.scene?.destroy();
    this.scene = null;

    if (this.rootElement && this.rootElement.parentElement) {
      this.rootElement.parentElement.removeChild(this.rootElement);
      this.rootElement = null;
    }

    this.container = null;
    this.inputManager = null;
  }
}
