/**
 * In-memory resource cache with in-flight de-duplication (design: Caching).
 * Memory only; a reload starts clean (UI-2.10, UI-2.11).
 */
import type { EnvelopeMeta } from "./schemas";

export interface CacheEntry<T> {
  data: T;
  envelope: EnvelopeMeta;
}

export type Fetcher<T> = () => Promise<CacheEntry<T>>;

export class ApiCache {
  private readonly values = new Map<string, CacheEntry<unknown>>();
  private readonly inflight = new Map<string, Promise<CacheEntry<unknown>>>();

  peek<T>(key: string): CacheEntry<T> | undefined {
    return this.values.get(key) as CacheEntry<T> | undefined;
  }

  /** `force` (retry) bypasses the stored value and any in-flight request. */
  load<T>(key: string, fetcher: Fetcher<T>, force = false): Promise<CacheEntry<T>> {
    if (!force) {
      const hit = this.values.get(key);
      if (hit) return Promise.resolve(hit as CacheEntry<T>);
      const pending = this.inflight.get(key);
      if (pending) return pending as Promise<CacheEntry<T>>;
    }
    const p = fetcher().then(
      (entry) => {
        this.values.set(key, entry);
        if (this.inflight.get(key) === p) this.inflight.delete(key);
        return entry;
      },
      (err: unknown) => {
        if (this.inflight.get(key) === p) this.inflight.delete(key);
        throw err;
      },
    );
    this.inflight.set(key, p);
    return p;
  }

  clear(): void {
    this.values.clear();
    this.inflight.clear();
  }
}
