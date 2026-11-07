/**
 * ING-4 / ING-13: Snapshot store unit tests.
 *
 * Uses an isolated tmp directory via SNAPSHOT_DIR env var so no test artifacts
 * accumulate in data/snapshots/.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { storeSnapshot, writeRejected, sha256Hex } from "@/server/ingest/snapshot-store";

let tmpDir: string;

beforeEach(() => {
  // Create a fresh isolated directory for each test
  tmpDir = mkdtempSync(join(tmpdir(), "plague-test-"));
  process.env["SNAPSHOT_DIR"] = tmpDir;
  process.env["NORMALIZED_DIR"] = join(tmpDir, "normalized");
});

afterEach(() => {
  // Clean up the temp directory after each test
  delete process.env["SNAPSHOT_DIR"];
  delete process.env["NORMALIZED_DIR"];
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
});

const META = {
  sourceUrl: "https://example.com/test.csv",
  fetchedAt: new Date().toISOString(),
  origin: "live" as const,
  schemaVersion: "trend-oct-2026",
  rowCount: 1,
  rejectedRows: 0,
};

function uniqueBytes(): Buffer {
  return Buffer.from(`Location,measureid\nTestLoc-${Math.random()},covN2\n`);
}

describe("ING-4: storeSnapshot", () => {
  it("stores a new snapshot and returns isNew: true", () => {
    const bytes = uniqueBytes();
    const result = storeSnapshot(bytes, META);
    expect(result.isNew).toBe(true);
    expect(result.snapshotId).toHaveLength(64); // sha256 hex
    // File was written to the temp dir, not the real store
    expect(existsSync(join(tmpDir, `${result.snapshotId}.csv`))).toBe(true);
  });

  it("ING-10/P4: re-ingesting the same file returns isNew: false (idempotent)", () => {
    const bytes = uniqueBytes();
    storeSnapshot(bytes, META);
    const result = storeSnapshot(bytes, META);
    expect(result.isNew).toBe(false);
  });

  it("different content produces a different snapshotId", () => {
    const r1 = storeSnapshot(uniqueBytes(), META);
    const r2 = storeSnapshot(uniqueBytes(), META);
    expect(r1.snapshotId).not.toBe(r2.snapshotId);
  });

  it("snapshotId matches sha256Hex of the raw bytes", () => {
    const bytes = uniqueBytes();
    const expected = sha256Hex(bytes);
    const result = storeSnapshot(bytes, META);
    expect(result.snapshotId).toBe(expected);
  });

  it("does NOT write to the real data/snapshots/ dir when SNAPSHOT_DIR is set", () => {
    const bytes = uniqueBytes();
    const result = storeSnapshot(bytes, META);
    // Must not exist in the production directory
    const realPath = join(process.cwd(), "data", "snapshots", `${result.snapshotId}.csv`);
    expect(existsSync(realPath)).toBe(false);
  });
});

describe("ING-4: writeRejected", () => {
  it("writes a .rejected.json in the temp dir and does not write a .csv", () => {
    const bytes = uniqueBytes();
    const snapshotId = sha256Hex(bytes);

    writeRejected(bytes, "schema_mismatch", {
      sourceUrl: "https://example.com/bad.csv",
      fetchedAt: new Date().toISOString(),
      origin: "live",
    });

    expect(existsSync(join(tmpDir, `${snapshotId}.rejected.json`))).toBe(true);
    expect(existsSync(join(tmpDir, `${snapshotId}.csv`))).toBe(false);
    // Also must not appear in the real store
    expect(existsSync(join(process.cwd(), "data", "snapshots", `${snapshotId}.csv`))).toBe(false);
  });
});
