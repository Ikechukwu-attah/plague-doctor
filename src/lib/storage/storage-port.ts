/** Injectable storage (UI-10). Tests use an in-memory implementation. */
export interface StoragePort {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** In-memory port for tests and as the fallback when localStorage is unavailable. */
export function createMemoryStorage(initial: Record<string, string> = {}): StoragePort & {
  snapshot(): Record<string, string>;
} {
  const m = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    snapshot: () => Object.fromEntries(m),
  };
}
