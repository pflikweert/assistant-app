type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type RequestCacheResult<T> = {
  value: T;
  cacheHit: boolean;
};

type InFlightTask<T> = Promise<RequestCacheResult<T>>;

export class RequestCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private inFlight = new Map<string, InFlightTask<unknown>>();

  async run<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
  ): Promise<RequestCacheResult<T>> {
    const now = Date.now();
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > now) {
      return { value: cached.value, cacheHit: true };
    }

    const active = this.inFlight.get(key) as InFlightTask<T> | undefined;
    if (active) return active;

    const task: InFlightTask<T> = (async () => {
      const value = await fetcher();
      const expiresAt = Date.now() + Math.max(0, Math.floor(ttlMs));
      this.cache.set(key, { value, expiresAt });
      return { value, cacheHit: false };
    })().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, task);
    return task;
  }

  clear(prefix?: string) {
    if (!prefix) {
      this.cache.clear();
      this.inFlight.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
    for (const key of this.inFlight.keys()) {
      if (key.startsWith(prefix)) this.inFlight.delete(key);
    }
  }
}

