import { InputManager } from '../input/InputManager';

export interface Game {
  readonly id: string;
  readonly title: string;

  /**
   * Initializes the game within the provided container DOM element.
   * Can be asynchronous (e.g. loading assets, initializing WebGL/Phaser/Three context).
   */
  init(container: HTMLElement, inputManager: InputManager): Promise<void> | void;

  /**
   * Main game logic update called every frame with elapsed delta-time in seconds.
   */
  update(dt: number): void;

  /**
   * Optional separate render call if decoupled from update.
   */
  render?(): void;

  /**
   * Cleanup and teardown of DOM, event listeners, audio, and graphics contexts.
   */
  destroy(): void;

  /**
   * Pauses internal clocks/sounds when pause overlay is open.
   */
  pause?(): void;

  /**
   * Resumes internal clocks/sounds.
   */
  resume?(): void;
}
