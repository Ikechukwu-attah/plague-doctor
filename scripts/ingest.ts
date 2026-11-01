/**
 * ING-8: Main ingestion entrypoint.
 *
 * Orchestrates:
 *   1. Fetch PHAC trend CSV with conditional GET
 *   2. Detect schema version
 *   3. Store immutable snapshot
 *   4. Parse and normalize
 *   5. Write data/normalized/trend-latest.json
 *   6. Same for aggregate, writing per-location history files
 *   7. Update data/normalized/index.json
 *
 * On schema mismatch: logs error, keeps last valid snapshot, exits with code 1.
 * Run: npm run ingest  (tsx scripts/ingest.ts)
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { fetchWithCache } from "../src/server/ingest/fetch";
import { detectSchema } from "../src/server/ingest/schema-registry";
import {
  storeSnapshot,
  writeRejected,
  loadLatestValidSnapshot,
  loadSnapshotBytes,
} from "../src/server/ingest/snapshot-store";
import { parseTrend } from "../src/server/ingest/parse-trend";
import { parseAggregate } from "../src/server/ingest/parse-aggregate";
import type { StatusObservation, MeasuredWeek } from "../src/evidence/types";

const TREND_URL =
  "https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv";
const AGGREGATE_URL =
  "https://health-infobase.canada.ca/src/data/wastewater/wastewater_aggregate.csv";

const NORMALIZED_DIR = join(process.cwd(), "data", "normalized");
const HISTORY_DIR = join(NORMALIZED_DIR, "history");

function ensureDirs(): void {
  mkdirSync(NORMALIZED_DIR, { recursive: true });
  mkdirSync(HISTORY_DIR, { recursive: true });
}

async function ingestTrend(): Promise<{
  snapshotId: string;
  observations: StatusObservation[];
} | null> {
  console.log(`[ingest] Fetching trend CSV: ${TREND_URL}`);
  const result = await fetchWithCache(TREND_URL);

  if (result.status === "not-modified") {
    console.log("[ingest] Trend file not modified (304) — using last snapshot");
    const last = loadLatestValidSnapshot("trend");
    if (!last) {
      console.error("[ingest] No previous valid trend snapshot found");
      return null;
    }
    const bytes = loadSnapshotBytes(last.snapshotId);
    if (!bytes) return null;
    const parsed = parseTrend(
      bytes,
      last.schemaVersion,
      last.snapshotId,
      TREND_URL
    );
    return { snapshotId: last.snapshotId, observations: parsed.observations };
  }

  if (result.status === "error") {
    console.error(`[ingest] Trend fetch error: ${result.reason}`);
    return null;
  }

  const { bytes, lastModified, etag } = result;

  // Detect schema — read the first non-empty line as the header
  const firstDataLine = bytes
    .toString("utf-8")
    .split("\n")
    .find((l) => l.trim().length > 0) ?? "";
  const actualHeaders = firstDataLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

  const schema = detectSchema("trend", actualHeaders);

  if (!schema) {
    console.error(
      `[ingest] SCHEMA MISMATCH — trend file headers do not match any registered schema.`
    );
    console.error(`  Actual headers: ${actualHeaders.join(", ")}`);
    console.error(`  Keeping last valid snapshot.`);
    writeRejected(bytes, "schema_mismatch: no matching registered schema", {
      sourceUrl: TREND_URL,
      fetchedAt: new Date().toISOString(),
      origin: "live",
    });
    process.exitCode = 1;
    return null;
  }

  console.log(`[ingest] Trend schema detected: ${schema.versionId}`);

  const fetchedAt = new Date().toISOString();
  const { snapshotId, isNew } = storeSnapshot(bytes, {
    sourceUrl: TREND_URL,
    fetchedAt,
    lastModified,
    etag,
    origin: "live",
    schemaVersion: schema.versionId,
    rowCount: 0, // updated after parse
    rejectedRows: 0,
  });

  console.log(
    `[ingest] Trend snapshot ${snapshotId.slice(0, 12)}… ${isNew ? "stored (new)" : "already exists"}`
  );

  const parsed = parseTrend(bytes, schema.versionId, snapshotId, TREND_URL);
  console.log(
    `[ingest] Trend parsed: ${parsed.observations.length} observations, ${parsed.rejectedRows} rejected rows`
  );

  return { snapshotId, observations: parsed.observations };
}

async function ingestAggregate(): Promise<{
  snapshotId: string;
  weeks: MeasuredWeek[];
} | null> {
  console.log(`[ingest] Fetching aggregate CSV: ${AGGREGATE_URL}`);
  const result = await fetchWithCache(AGGREGATE_URL);

  if (result.status === "not-modified") {
    console.log(
      "[ingest] Aggregate file not modified (304) — using last snapshot"
    );
    const last = loadLatestValidSnapshot("aggregate");
    if (!last) return null;
    const bytes = loadSnapshotBytes(last.snapshotId);
    if (!bytes) return null;
    const parsed = parseAggregate(bytes, last.snapshotId, AGGREGATE_URL);
    return { snapshotId: last.snapshotId, weeks: parsed.weeks };
  }

  if (result.status === "error") {
    console.error(`[ingest] Aggregate fetch error: ${result.reason}`);
    return null;
  }

  const { bytes, lastModified, etag } = result;

  const firstDataLine = bytes
    .toString("utf-8")
    .split("\n")
    .find((l) => l.trim().length > 0 && !l.trim().startsWith("#")) ?? "";
  const actualHeaders = firstDataLine
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));

  const schema = detectSchema("aggregate", actualHeaders);

  if (!schema) {
    console.error(`[ingest] SCHEMA MISMATCH — aggregate file not recognized.`);
    writeRejected(bytes, "schema_mismatch", {
      sourceUrl: AGGREGATE_URL,
      fetchedAt: new Date().toISOString(),
      origin: "live",
    });
    process.exitCode = 1;
    return null;
  }

  console.log(`[ingest] Aggregate schema detected: ${schema.versionId}`);

  const fetchedAt = new Date().toISOString();
  const { snapshotId, isNew } = storeSnapshot(bytes, {
    sourceUrl: AGGREGATE_URL,
    fetchedAt,
    lastModified,
    etag,
    origin: "live",
    schemaVersion: schema.versionId,
    rowCount: 0,
    rejectedRows: 0,
  });

  console.log(
    `[ingest] Aggregate snapshot ${snapshotId.slice(0, 12)}… ${isNew ? "stored" : "already exists"}`
  );

  const parsed = parseAggregate(bytes, snapshotId, AGGREGATE_URL);
  console.log(
    `[ingest] Aggregate parsed: ${parsed.weeks.length} weeks, ${parsed.rejectedRows} rejected`
  );

  return { snapshotId, weeks: parsed.weeks };
}

function writeHistoryFiles(weeks: MeasuredWeek[]): void {
  // Group by locationId × pathogen
  const groups = new Map<string, MeasuredWeek[]>();
  for (const week of weeks) {
    const key = `${week.locationId}-${week.pathogen}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(week);
    } else {
      groups.set(key, [week]);
    }
  }

  for (const [key, rows] of groups) {
    const filePath = join(HISTORY_DIR, `${key}.json`);
    writeFileSync(filePath, JSON.stringify(rows, null, 2));
  }

  console.log(`[ingest] Wrote ${groups.size} history files`);
}

async function main(): Promise<void> {
  ensureDirs();
  console.log("[ingest] Starting Plague Doctor ingestion pipeline");
  console.log(`[ingest] Timestamp: ${new Date().toISOString()}`);

  const trendResult = await ingestTrend();
  if (!trendResult) {
    console.warn("[ingest] Trend ingestion failed or not modified");
  } else {
    // Write trend-latest.json
    const latestPath = join(NORMALIZED_DIR, "trend-latest.json");
    writeFileSync(latestPath, JSON.stringify(trendResult.observations, null, 2));
    console.log(
      `[ingest] Wrote trend-latest.json (${trendResult.observations.length} records)`
    );
  }

  const aggregateResult = await ingestAggregate();
  if (!aggregateResult) {
    console.warn("[ingest] Aggregate ingestion failed or not modified");
  } else {
    writeHistoryFiles(aggregateResult.weeks);
  }

  console.log("[ingest] Done.");
}

main().catch((err) => {
  console.error("[ingest] Fatal error:", err);
  process.exit(1);
});
