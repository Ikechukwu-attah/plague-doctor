/**
 * ING-4 / ING-13: Immutable snapshot storage.
 *
 * The snapshot directory is injectable via the SNAPSHOT_DIR environment variable
 * (default: data/snapshots/ relative to process.cwd()).
 * This allows tests to use isolated temp directories without polluting the real store.
 */
import { createHash } from "crypto";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { SourceSnapshot } from "@/evidence/types";

// ---------------------------------------------------------------------------
// Directory resolution — injectable for tests
// ---------------------------------------------------------------------------

function getSnapshotsDir(): string {
  return process.env["SNAPSHOT_DIR"] ?? join(process.cwd(), "data", "snapshots");
}

/**
 * Normalized output directory (index.json, trend-latest.json, history/).
 * Injectable via NORMALIZED_DIR (default: data/normalized/), mirroring SNAPSHOT_DIR. (UI-18.3)
 */
export function getNormalizedDir(): string {
  return process.env["NORMALIZED_DIR"] ?? join(process.cwd(), "data", "normalized");
}

function getIndexPath(): string {
  return join(getNormalizedDir(), "index.json");
}

function ensureDirs(): void {
  mkdirSync(getSnapshotsDir(), { recursive: true });
  mkdirSync(getNormalizedDir(), { recursive: true });
}

// ---------------------------------------------------------------------------
// Core utilities
// ---------------------------------------------------------------------------

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface StoreResult {
  snapshotId: string;
  isNew: boolean;
}

/**
 * Store a valid snapshot.
 * Idempotent: same sha256 → no-op, isNew: false.
 */
export function storeSnapshot(
  rawBytes: Buffer,
  meta: Omit<SourceSnapshot, "snapshotId" | "status">
): StoreResult {
  ensureDirs();

  const dir = getSnapshotsDir();
  const snapshotId = sha256Hex(rawBytes);
  const csvPath = join(dir, `${snapshotId}.csv`);

  if (existsSync(csvPath)) {
    // Bytes are immutable; only correct metadata (rowCount 0 from older runs)
    // and make sure the index lists this snapshot (UI-18.5).
    const metaPath = join(dir, `${snapshotId}.meta.json`);
    let existing: SourceSnapshot | null = null;
    try {
      if (existsSync(metaPath)) {
        existing = JSON.parse(readFileSync(metaPath, "utf-8")) as SourceSnapshot;
      }
    } catch {
      existing = null;
    }
    if (existing && existing.status === "valid") {
      const fixed: SourceSnapshot =
        existing.rowCount === 0 && meta.rowCount > 0
          ? { ...existing, rowCount: meta.rowCount, rejectedRows: meta.rejectedRows }
          : existing;
      if (fixed !== existing) {
        writeFileSync(metaPath, JSON.stringify(fixed, null, 2));
      }
      const index = loadIndex();
      const current = index.find((s) => s.snapshotId === snapshotId);
      if (!current || current.rowCount !== fixed.rowCount) {
        saveIndex([...index.filter((s) => s.snapshotId !== snapshotId), fixed]);
      }
    }
    return { snapshotId, isNew: false };
  }

  const snapshot: SourceSnapshot = { ...meta, snapshotId, status: "valid" };

  writeFileSync(csvPath, rawBytes);
  writeFileSync(
    join(dir, `${snapshotId}.meta.json`),
    JSON.stringify(snapshot, null, 2)
  );

  // Index lives in getNormalizedDir(); tests must set NORMALIZED_DIR (UI-18.3)
  const index = loadIndex();
  const filtered = index.filter((s) => s.snapshotId !== snapshotId);
  filtered.push(snapshot);
  saveIndex(filtered);

  return { snapshotId, isNew: true };
}

/**
 * Write a rejection record for diagnostics. Does NOT write a .csv.
 */
export function writeRejected(
  rawBytes: Buffer,
  reason: string,
  meta: Pick<SourceSnapshot, "sourceUrl" | "fetchedAt" | "origin">
): void {
  ensureDirs();
  const dir = getSnapshotsDir();
  const snapshotId = sha256Hex(rawBytes);
  const rejectedPath = join(dir, `${snapshotId}.rejected.json`);

  const record: SourceSnapshot = {
    snapshotId,
    sourceUrl: meta.sourceUrl,
    fetchedAt: meta.fetchedAt,
    origin: meta.origin,
    schemaVersion: "unknown",
    rowCount: 0,
    rejectedRows: 0,
    status: "rejected",
  };

  writeFileSync(rejectedPath, JSON.stringify({ ...record, reason }, null, 2));
}

/**
 * Load the snapshot index from data/normalized/index.json.
 */
export function loadIndex(): SourceSnapshot[] {
  const indexPath = getIndexPath();
  try {
    if (existsSync(indexPath)) {
      return JSON.parse(readFileSync(indexPath, "utf-8")) as SourceSnapshot[];
    }
  } catch {
    // Corrupt index — start fresh
  }
  return [];
}

function saveIndex(index: SourceSnapshot[]): void {
  mkdirSync(getNormalizedDir(), { recursive: true });
  writeFileSync(getIndexPath(), JSON.stringify(index, null, 2));
}

/**
 * Load the most recent valid snapshot for a given file type (by fetchedAt).
 */
export function loadLatestValidSnapshot(
  fileType: "trend" | "aggregate"
): SourceSnapshot | null {
  const index = loadIndex();
  const valid = index
    .filter(
      (s) =>
        s.status === "valid" &&
        s.schemaVersion.startsWith(fileType === "trend" ? "trend" : "aggregate")
    )
    .sort(
      (a, b) =>
        new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
    );
  return valid[0] ?? null;
}

/**
 * Load raw bytes for a snapshot by ID.
 */
export function loadSnapshotBytes(snapshotId: string): Buffer | null {
  const csvPath = join(getSnapshotsDir(), `${snapshotId}.csv`);
  if (!existsSync(csvPath)) return null;
  return readFileSync(csvPath);
}

/**
 * Load snapshot metadata by ID.
 */
export function loadSnapshotMeta(snapshotId: string): SourceSnapshot | null {
  const metaPath = join(getSnapshotsDir(), `${snapshotId}.meta.json`);
  if (!existsSync(metaPath)) return null;
  return JSON.parse(readFileSync(metaPath, "utf-8")) as SourceSnapshot;
}
