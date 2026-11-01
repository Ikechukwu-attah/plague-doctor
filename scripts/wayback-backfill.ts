/**
 * ING-9: Wayback Machine backfill script.
 * Gate: only run after live ingestion (ING-2 → ING-7) passes.
 *
 * 1. Queries Wayback CDX API for archived captures of wastewater_trend.csv.
 * 2. Fetches each archived file via Wayback's replay URL.
 * 3. Validates schema, stores snapshot with origin: "wayback" + archivedAt.
 * 4. Skips captures whose snapshotId already exists (idempotent).
 *
 * archivedAt (Wayback capture timestamp) ≠ weekStart (sample date from file content).
 */
import {
  storeSnapshot,
  writeRejected,
  loadIndex,
} from "../src/server/ingest/snapshot-store";
import { detectSchema } from "../src/server/ingest/schema-registry";
import { parseTrend } from "../src/server/ingest/parse-trend";
import { sha256Hex } from "../src/server/ingest/snapshot-store";

const TREND_SOURCE_URL =
  "https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv";

const CDX_API_URL =
  "https://web.archive.org/cdx/search/cdx?" +
  "url=health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv" +
  "&output=json" +
  "&fl=timestamp,original,statuscode" +
  "&filter=statuscode:200" +
  "&collapse=digest"; // deduplicate identical content

const WAYBACK_TIMEOUT_MS = 60_000; // slower mirrors
const MAX_BYTES = 20 * 1024 * 1024;

interface CdxRecord {
  timestamp: string;
  original: string;
  statuscode: string;
}

async function fetchCdxCaptures(): Promise<CdxRecord[]> {
  console.log("[wayback] Querying CDX API...");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(CDX_API_URL, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      console.error(`[wayback] CDX API returned ${response.status}`);
      return [];
    }

    const rows = (await response.json()) as Array<string[]>;
    // First row is header ["timestamp","original","statuscode"]
    if (rows.length < 2) return [];

    const [header, ...data] = rows;
    if (!header) return [];

    return data.map((row) => ({
      timestamp: row[0] ?? "",
      original: row[1] ?? "",
      statuscode: row[2] ?? "",
    }));
  } catch (err) {
    clearTimeout(timer);
    console.error("[wayback] CDX fetch error:", err);
    return [];
  }
}

function waybackUrl(timestamp: string, original: string): string {
  // Append "if_" to get the raw file without Wayback toolbar injection
  return `https://web.archive.org/web/${timestamp}if_/${original}`;
}

async function fetchWaybackCapture(
  url: string
): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WAYBACK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "plague-doctor/0.1 (Kiroween 2026; educational use; Wayback backfill)",
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`[wayback] ${response.status} for ${url}`);
      return null;
    }

    const reader = response.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > MAX_BYTES) {
          reader.cancel();
          console.warn(`[wayback] Size limit exceeded for ${url}`);
          return null;
        }
        chunks.push(value);
      }
    }

    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[wayback] Fetch error for ${url}:`, err);
    return null;
  }
}

async function main(): Promise<void> {
  console.log("[wayback] Starting Wayback backfill");

  // Load existing snapshot IDs to skip already-processed captures
  const existingIndex = loadIndex();
  const existingIds = new Set(existingIndex.map((s) => s.snapshotId));
  console.log(`[wayback] ${existingIds.size} existing snapshots`);

  const captures = await fetchCdxCaptures();
  console.log(`[wayback] Found ${captures.length} CDX captures`);

  let newCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const capture of captures) {
    const { timestamp, original } = capture;
    // Convert Wayback timestamp (YYYYMMDDhhmmss) to ISO
    const archivedAt = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}Z`;

    const url = waybackUrl(timestamp, original);
    console.log(`[wayback] Processing ${archivedAt} — ${url}`);

    const bytes = await fetchWaybackCapture(url);
    if (!bytes) {
      failedCount++;
      continue;
    }

    // Quick idempotency check on content hash before schema detection
    const snapshotId = sha256Hex(bytes);
    if (existingIds.has(snapshotId)) {
      console.log(`[wayback]   Already exists (${snapshotId.slice(0, 12)}…) — skipping`);
      skippedCount++;
      continue;
    }

    // Detect schema — read the first non-empty line as the header
    const firstDataLine = bytes
      .toString("utf-8")
      .split("\n")
      .find((l) => l.trim().length > 0) ?? "";
    const actualHeaders = firstDataLine
      .split(",")
      .map((h) => h.trim().replace(/^"|"$/g, ""));

    const schema = detectSchema("trend", actualHeaders);

    if (!schema) {
      console.warn(
        `[wayback]   Unknown schema for ${archivedAt} — headers: ${actualHeaders.slice(0, 5).join(", ")}…`
      );
      writeRejected(bytes, "schema_mismatch", {
        sourceUrl: url,
        fetchedAt: new Date().toISOString(),
        origin: "wayback",
      });
      failedCount++;
      continue;
    }

    const { observations } = parseTrend(bytes, schema.versionId, snapshotId, TREND_SOURCE_URL);

    const { isNew } = storeSnapshot(bytes, {
      sourceUrl: TREND_SOURCE_URL,
      fetchedAt: new Date().toISOString(),
      origin: "wayback",
      archivedAt,
      schemaVersion: schema.versionId,
      rowCount: observations.length,
      rejectedRows: 0,
    });

    if (isNew) {
      existingIds.add(snapshotId);
      newCount++;
      console.log(
        `[wayback]   Stored ${snapshotId.slice(0, 12)}… (schema: ${schema.versionId}, ${observations.length} rows)`
      );
    } else {
      skippedCount++;
    }

    // Polite delay between Wayback requests
    await new Promise((r) => setTimeout(r, 1_000));
  }

  console.log(
    `[wayback] Done. New: ${newCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`
  );
}

main().catch((err) => {
  console.error("[wayback] Fatal:", err);
  process.exit(1);
});
