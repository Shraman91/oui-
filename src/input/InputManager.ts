import { InputProvider } from './providers/InputProvider';

export interface Vector2D {
  x: number;
  y: number;
}

export interface InputState {
  pointer: Vector2D; // normalized 0..1
  pointerVelocity: Vector2D; // normalized units per second
  tilt: { roll: number; pitch: number }; // -1..1
  buttonA: boolean;
  buttonB: boolean;
}

export interface SwingEventPayload {
  speed: number;
  direction: Vector2D;
}

export interface InputEventMap {
  swing: SwingEventPayload;
  pressA: void;
  pressB: void;
  releaseA: void;
  releaseB: void;
}

export type InputEventListener<T> = (payload: T) => void;

export class InputManager {
  private state: InputState = {
    pointer: { x: 0.5, y: 0.5 },
    pointerVelocity: { x: 0, y: 0 },
    tilt: { roll: 0, pitch: 0 },
    buttonA: false,
    buttonB: false
  };

  private swingListeners = new Set<InputEventListener<SwingEventPayload>>();
  private pressAListeners = new Set<InputEventListener<void>>();
  private pressBListeners = new Set<InputEventListener<void>>();
  private releaseAListeners = new Set<InputEventListener<void>>();
  private releaseBListeners = new Set<InputEventListener<void>>();
  private rumbleListeners = new Set<(strength: number, durationMs: number) => void>();

  private providers: Map<string, InputProvider> = new Map();
  private activeProvider: InputProvider | null = null;

  public getState(): Readonly<InputState> {
    return this.state;
  }

  /**
   * Internal/provider state updater.
   */
  public updateState(partial: Partial<InputState>): void {
    if (partial.pointer !== undefined) {
      this.state.pointer = { ...partial.pointer };
    }
    if (partial.pointerVelocity !== undefined) {
      this.state.pointerVelocity = { ...partial.pointerVelocity };
    }
    if (partial.tilt !== undefined) {
      this.state.tilt = { ...partial.tilt };
    }
    if (partial.buttonA !== undefined) {
      this.state.buttonA = partial.buttonA;
    }
    if (partial.buttonB !== undefined) {
      this.state.buttonB = partial.buttonB;
    }
  }

  /**
   * Dispatches typed input events to registered listeners.
   */
  public emit<K extends keyof InputEventMap>(event: K, payload: InputEventMap[K]): void {
    switch (event) {
      case 'swing':
        for (const fn of this.swingListeners) {
          fn(payload as SwingEventPayload);
        }
        break;
      case 'pressA':
        for (const fn of this.pressAListeners) {
          fn(undefined);
        }
        break;
      case 'pressB':
        for (const fn of this.pressBListeners) {
          fn(undefined);
        }
        break;
      case 'releaseA':
        for (const fn of this.releaseAListeners) {
          fn(undefined);
        }
        break;
      case 'releaseB':
        for (const fn of this.releaseBListeners) {
          fn(undefined);
        }
        break;
    }
  }

  /**
   * Subscribes to an input event. Returns an unsubscribe function.
   */
  public on<K extends keyof InputEventMap>(
    event: K,
    listener: InputEventListener<InputEventMap[K]>
  ): () => void {
    switch (event) {
      case 'swing': {
        const typedListener = listener as InputEventListener<SwingEventPayload>;
        this.swingListeners.add(typedListener);
        return () => {
          this.swingListeners.delete(typedListener);
        };
      }
      case 'pressA': {
        const typedListener = listener as InputEventListener<void>;
        this.pressAListeners.add(typedListener);
        return () => {
          this.pressAListeners.delete(typedListener);
        };
      }
      case 'pressB': {
        const typedListener = listener as InputEventListener<void>;
        this.pressBListeners.add(typedListener);
        return () => {
          this.pressBListeners.delete(typedListener);
        };
      }
      case 'releaseA': {
        const typedListener = listener as InputEventListener<void>;
        this.releaseAListeners.add(typedListener);
        return () => {
          this.releaseAListeners.delete(typedListener);
        };
      }
      case 'releaseB': {
        const typedListener = listener as InputEventListener<void>;
        this.releaseBListeners.add(typedListener);
        return () => {
          this.releaseBListeners.delete(typedListener);
        };
      }
    }
  }

  /**
   * Unsubscribes from an input event.
   */
  public off<K extends keyof InputEventMap>(
    event: K,
    listener: InputEventListener<InputEventMap[K]>
  ): void {
    switch (event) {
      case 'swing':
        this.swingListeners.delete(listener as InputEventListener<SwingEventPayload>);
        break;
      case 'pressA':
        this.pressAListeners.delete(listener as InputEventListener<void>);
        break;
      case 'pressB':
        this.pressBListeners.delete(listener as InputEventListener<void>);
        break;
      case 'releaseA':
        this.releaseAListeners.delete(listener as InputEventListener<void>);
        break;
      case 'releaseB':
        this.releaseBListeners.delete(listener as InputEventListener<void>);
        break;
    }
  }

  /**
   * Triggers haptic rumble on the active controller (phone).
   */
  public rumble(strength = 1.0, durationMs = 150): void {
    for (const listener of this.rumbleListeners) {
      listener(strength, durationMs);
    }
  }

  public onRumble(listener: (strength: number, durationMs: number) => void): () => void {
    this.rumbleListeners.add(listener);
    return () => this.rumbleListeners.delete(listener);
  }

  /**
   * Registers an input provider (e.g. Mouse, Hand, Phone).
   */
  public registerProvider(provider: InputProvider): void {
    this.providers.set(provider.id, provider);
    if (!this.activeProvider) {
      this.setActiveProvider(provider.id);
    }
  }

  /**
   * Switches the active input provider at runtime.
   */
  public setActiveProvider(id: string): boolean {
    const next = this.providers.get(id);
    if (!next) return false;

    if (this.activeProvider && this.activeProvider !== next) {
      this.activeProvider.stop();
    }

    this.activeProvider = next;
    this.activeProvider.start();
    return true;
  }

  public getActiveProvider(): InputProvider | null {
    return this.activeProvider;
  }

  public getProviders(): InputProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Advances active provider loop each frame.
   */
  public update(dt: number): void {
    if (this.activeProvider) {
      this.activeProvider.update(dt);
    }
  }

  /**
   * Cleanly stops active provider and clears listeners.
   */
  public destroy(): void {
    if (this.activeProvider) {
      this.activeProvider.stop();
    }
    this.swingListeners.clear();
    this.pressAListeners.clear();
    this.pressBListeners.clear();
    this.releaseAListeners.clear();
    this.releaseBListeners.clear();
    this.providers.clear();
    this.activeProvider = null;
  }
}
