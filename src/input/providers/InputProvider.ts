export interface InputProvider {
  readonly id: string;
  readonly name: string;
  start(): void;
  stop(): void;
  update(dt: number): void;
}
