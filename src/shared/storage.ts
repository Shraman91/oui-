export interface GameScoreEntry {
  gameId: string;
  highScore: number;
  date: string;
}

const STORAGE_PREFIX = 'oui_console_';

export class StorageManager {
  public static getHighScore(gameId: string): number {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}score_${gameId}`);
      if (!raw) return 0;
      const parsed = Number.parseInt(raw, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    } catch {
      return 0;
    }
  }

  public static saveHighScore(gameId: string, score: number): boolean {
    try {
      const current = this.getHighScore(gameId);
      if (score > current) {
        localStorage.setItem(`${STORAGE_PREFIX}score_${gameId}`, score.toString());
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public static getItem<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  public static setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }
}
