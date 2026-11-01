/**
 * ING-2: Server-side fetch with conditional GET, timeout, and size limit.
 * Never called from the browser — server-side only.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Fetch timed out after ${timeoutMs}ms: ${url}`);
    this.name = "FetchTimeoutError";
  }
}

export class FetchSizeLimitError extends Error {
  constructor(url: string, limitBytes: number) {
    super(`Response exceeded size limit of ${limitBytes} bytes: ${url}`);
    this.name = "FetchSizeLimitError";
  }
}

export type FetchResult =
  | {
      status: "fetched";
      bytes: Buffer;
      contentLength: number;
      lastModified?: string;
      etag?: string;
    }
  | { status: "not-modified" }
  | { status: "error"; reason: string };

interface EtagCache {
  [url: string]: {
    etag?: string;
    lastModified?: string;
  };
}

const ETAG_CACHE_PATH = join(
  process.cwd(),
  "data",
  "snapshots",
  "etag-cache.json"
);

function loadEtagCache(): EtagCache {
  try {
    if (existsSync(ETAG_CACHE_PATH)) {
      return JSON.parse(readFileSync(ETAG_CACHE_PATH, "utf-8")) as EtagCache;
    }
  } catch {
    // Corrupt cache — start fresh
  }
  return {};
}

function saveEtagCache(cache: EtagCache): void {
  const dir = join(process.cwd(), "data", "snapshots");
  mkdirSync(dir, { recursive: true });
  writeFileSync(ETAG_CACHE_PATH, JSON.stringify(cache, null, 2));
}

export async function fetchWithCache(
  url: string,
  opts: {
    timeoutMs?: number;
    maxBytes?: number;
    /** Override the ETag cache dir (for testing) */
    cacheDir?: string;
  } = {}
): Promise<FetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  const cache = loadEtagCache();
  const cached = cache[url];

  const headers: Record<string, string> = {
    "User-Agent": "plague-doctor/0.1 (Kiroween 2026; educational use)",
  };

  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }
  if (cached?.lastModified) {
    headers["If-Modified-Since"] = cached.lastModified;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (response.status === 304) {
      return { status: "not-modified" };
    }

    if (!response.ok) {
      return {
        status: "error",
        reason: `HTTP ${response.status} ${response.statusText} for ${url}`,
      };
    }

    // Stream response and enforce size limit
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const reader = response.body?.getReader();

    if (!reader) {
      return { status: "error", reason: "Response body is empty" };
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          reader.cancel();
          throw new FetchSizeLimitError(url, maxBytes);
        }
        chunks.push(value);
      }
    }

    const bytes = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const lastModified = response.headers.get("Last-Modified") ?? undefined;
    const etag = response.headers.get("ETag") ?? undefined;

    // Update ETag cache
    cache[url] = { etag, lastModified };
    saveEtagCache(cache);

    return {
      status: "fetched",
      bytes,
      contentLength: totalBytes,
      lastModified,
      etag,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof FetchTimeoutError || err instanceof FetchSizeLimitError) {
      throw err;
    }
    if ((err as { name?: string }).name === "AbortError") {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    return {
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
