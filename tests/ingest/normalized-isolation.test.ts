/**
 * UI-18.3 UI-18.4: ingestion store operations with temp dirs never touch data/normalized/.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "fs";
import { createHash } from "crypto";
import { join } from "path";
import { tmpdir } from "os";
import {
  storeSnapshot,
  writeRejected,
  loadIndex,
  getNormalizedDir,
} from "@/server/ingest/snapshot-store";

const REAL_NORMALIZED = join(process.cwd(), "data", "normalized");
const REAL_SNAPSHOTS = join(process.cwd(), "data", "snapshots");

interface Fingerprint {
  files: string[];
  hashes: Record<string, string>;
  mtimes: Record<string, number>;
}

function walk(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(full.slice(base.length + 1));
  }
  return out.sort();
}

function fingerprint(dir: string): Fingerprint {
  const files = walk(dir);
  const hashes: Record<string, string> = {};
  const mtimes: Record<string, number> = {};
  for (const f of files) {
    const p = join(dir, f);
    hashes[f] = createHash("sha256").update(readFileSync(p)).digest("hex");
    mtimes[f] = statSync(p).mtimeMs;
  }
  return { files, hashes, mtimes };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "plague-iso-"));
  process.env["SNAPSHOT_DIR"] = join(tmpDir, "snapshots");
  process.env["NORMALIZED_DIR"] = join(tmpDir, "normalized");
});

afterEach(() => {
  delete process.env["SNAPSHOT_DIR"];
  delete process.env["NORMALIZED_DIR"];
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("UI-18.3 UI-18.4: ingestion tests are isolated from data/normalized/", () => {
  it("resolves the normalized dir to the temp dir, not the real one", () => {
    expect(getNormalizedDir()).toBe(join(tmpDir, "normalized"));
    expect(getNormalizedDir()).not.toBe(REAL_NORMALIZED);
  });

  it("store operations leave data/normalized/ and data/snapshots/ unchanged", () => {
    const beforeNorm = fingerprint(REAL_NORMALIZED);
    const beforeSnap = fingerprint(REAL_SNAPSHOTS);

    const meta = {
      sourceUrl: "https://example.com/isolation.csv",
      fetchedAt: new Date().toISOString(),
      origin: "live" as const,
      schemaVersion: "trend-oct-2026",
      rowCount: 1,
      rejectedRows: 0,
    };
    const bytes = Buffer.from(`Location,measureid\nIso-${Math.random()},covN2\n`);
    const first = storeSnapshot(bytes, meta);
    const again = storeSnapshot(bytes, meta);
    writeRejected(Buffer.from("bad"), "test", {
      sourceUrl: meta.sourceUrl,
      fetchedAt: meta.fetchedAt,
      origin: "live",
    });

    expect(first.isNew).toBe(true);
    expect(again.isNew).toBe(false);
    // Index was written, but into the temp dir
    expect(existsSync(join(tmpDir, "normalized", "index.json"))).toBe(true);
    expect(loadIndex().map((s) => s.snapshotId)).toContain(first.snapshotId);

    const afterNorm = fingerprint(REAL_NORMALIZED);
    const afterSnap = fingerprint(REAL_SNAPSHOTS);
    expect(afterNorm).toEqual(beforeNorm);
    expect(afterSnap).toEqual(beforeSnap);
  });
});
