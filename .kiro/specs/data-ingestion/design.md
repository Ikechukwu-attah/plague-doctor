# Data Ingestion — Design

**Spec:** data-ingestion  
**References:** `docs/BUILD_PLAN.md` v2.2 §6 §7 §8; `.kiro/steering/architecture.md`; `.kiro/steering/scientific-integrity.md`; `.kiro/steering/coding-and-testing.md`

---

## 1. Overview

Milestone 1 delivers a server-side-only data ingestion pipeline that:

1. Fetches PHAC wastewater CSVs with conditional GET.
2. Validates the header fingerprint against a versioned schema registry.
3. Stores each valid file as an immutable sha256-keyed snapshot.
4. Normalizes rows into typed JSON using PHAC values verbatim.
5. Exposes five read-only API routes, each embedding `snapshotId` + `sampleWeek` + `sourceUrl`.
6. Passes a suite of fast-check property tests using real PHAC fixtures.
7. Optionally backfills Wayback Machine archives (after the live path passes).

No UI is built in this milestone. The evidence engine (card logic) is out of scope.

---

## 2. Directory structure

```
plague-doctor/
├── src/
│   ├── server/
│   │   └── ingest/
│   │       ├── fetch.ts            # conditional GET, timeout, size limit
│   │       ├── schema-registry.ts  # header fingerprints + schema definitions
│   │       ├── parse-trend.ts      # CSV → StatusObservation[]
│   │       ├── parse-aggregate.ts  # CSV → MeasuredWeek[]
│   │       └── snapshot-store.ts   # sha256, write data/snapshots/, idempotency
│   ├── evidence/
│   │   └── types.ts                # shared normalized types (no I/O)
│   └── app/
│       └── api/
│           ├── locations/route.ts
│           ├── observations/route.ts
│           ├── status/route.ts
│           ├── data-status/route.ts
│           └── snapshots/route.ts
├── scripts/
│   ├── ingest.ts                   # entrypoint: run full ingestion
│   └── wayback-backfill.ts         # post-gate Wayback script
├── data/
│   ├── snapshots/                  # <sha256>.csv + <sha256>.meta.json
│   └── normalized/
│       ├── trend-latest.json
│       ├── index.json
│       └── history/                # <locationId>-<pathogen>.json
├── fixtures/
│   ├── trend-oct-2026.real.csv     # trimmed real bytes, labelled with retrieval date
│   ├── trend-dec-2025.real.csv
│   └── aggregate-oct-2026.real.csv
└── tests/
    ├── ingest/
    │   ├── fetch.test.ts
    │   ├── schema-registry.test.ts
    │   ├── parse-trend.test.ts
    │   └── snapshot-store.test.ts
    └── properties/
        └── ingestion.property.test.ts   # fast-check P1,P2,P4,P5,P6,P7
```

---

## 3. Core types (`src/evidence/types.ts`)

Verbatim from BUILD_PLAN §6 — no invented fields:

```ts
export type Pathogen = "covid19" | "fluA" | "fluB" | "rsv";
export type Activity = "high" | "moderate" | "low" | "not_detected" | "unknown";
export type UnknownReason =
  | "na1_new_site"
  | "na2_not_sampling"
  | "no_recent_data"
  | "aggregate_below_coverage"
  | "missing_row"
  | "parse_error";
export type Direction = "increasing" | "stable" | "decreasing" | "unknown";

export interface StatusObservation {
  snapshotId: string;
  locationId: string;
  grouping: "site" | "city" | "province" | "national";
  pathogen: Pathogen;
  weekStart: string;             // ISO date YYYY-MM-DD
  activityIndex: Activity;
  unknownReason?: UnknownReason;
  signalLevel: Activity;
  trend: Direction;
  interpretationMethod: "publisher";
  sourceUrl: string;
}

export interface MeasuredWeek {
  snapshotId: string;
  locationId: string;
  pathogen: Pathogen;
  epiYear: number;
  epiWeek: number;
  weekStart: string;
  wAvg: number | null;
  histMin: number | null;
  histMax: number | null;
  populationCoverage: number | null;
}

export interface SourceSnapshot {
  snapshotId: string;
  sourceUrl: string;
  fetchedAt: string;
  lastModified?: string;
  etag?: string;
  origin: "live" | "wayback";
  archivedAt?: string;
  schemaVersion: string;
  rowCount: number;
  rejectedRows: number;
  status: "valid" | "rejected";
}
```

All Zod schemas are derived from these TypeScript types; they are the single source of truth.

---

## 4. Schema registry (`src/server/ingest/schema-registry.ts`)

### Header fingerprinting

A fingerprint is the SHA-256 of the sorted, lowercased, pipe-joined required column names:

```
fingerprint = sha256(sorted(required_cols.map(c => c.toLowerCase())).join("|"))
```

This is order-independent: reordered known columns hash to the same fingerprint.

### Registered schemas

```ts
const SCHEMAS = {
  "trend-oct-2026": {
    file: "trend",
    requiredColumns: [
      "Location","measureid","latestTrend","pruid","min","max",
      "latestLevel","grouping","city","province","country",
      "Viral_Activity_Level","weekStart"
    ],
  },
  "trend-dec-2025": {
    file: "trend",
    requiredColumns: [
      "Location","measureid","latestTrend","pruid","t_low","t_high",
      "latestLevel","grouping","city","province","country",
      "Viral_Activity_Level","weekStart"
    ],
  },
  "aggregate-v1": {
    file: "aggregate",
    requiredColumns: [
      "Location","site","city","province","country",
      "EpiYear","EpiWeek","weekstart","measureid",
      "w_avg","min","max","populationcoverage","pruid"
    ],
  },
} satisfies Record<string, SchemaDefinition>;
```

### Matching logic

1. Compute the fingerprint of the actual CSV headers.
2. Scan registered schemas for the same file type in fingerprint order.
3. If a match is found → return schema version ID.
4. If no match → return `null` (caller rejects the file, keeps last valid snapshot, emits CI alert).

Extra unexpected columns: treated as mismatch → reject. The schema defines the exact expected set.

### Column-access rule

Parsers always look up values by column name using the header map, never by index. This makes reordering safe.

---

## 5. Fetch layer (`src/server/ingest/fetch.ts`)

```
fetchWithCache(url, cacheDir) → FetchResult
```

- Reads stored ETag/Last-Modified from `<cacheDir>/etag-cache.json`.
- Sends `If-None-Match` / `If-Modified-Since` headers.
- On 304: returns `{ status: "not-modified" }`.
- On 200: streams into a `Buffer`, aborts if `Content-Length` or accumulated bytes > `MAX_SIZE_BYTES` (default 20 MB). On timeout (default 30 s with `AbortController`): throws a `FetchTimeoutError`.
- On success: updates `etag-cache.json` with the new ETag and Last-Modified.
- On any network/HTTP error: throws a typed error; caller catches and keeps last valid snapshot.

No browser fetch. Node `fetch` (Node 18+) or `undici` used for server-side fetches.

---

## 6. Parsers

### `parse-trend.ts`

Input: raw CSV `Buffer`, schema version ID, snapshotId, sourceUrl.  
Output: `{ observations: StatusObservation[], rejectedRows: number }`.

Algorithm:
1. Parse CSV with `csv-parse` (sync, header-mode).
2. Build a header→index map from row 0.
3. For each data row, look up values by column name.
4. Map each value using the lookup tables from ING-5.
5. Run the Zod `StatusObservationRow` schema; on failure, increment `rejectedRows`, log the error, continue.
6. Resolve `locationId` = `slugify(row.Location)` (deterministic, no mutation).

**NA1 + valid latestLevel coexistence:** when `Viral_Activity_Level = "NA1"`, still parse `latestLevel` independently.

### `parse-aggregate.ts`

Input: raw CSV `Buffer`, snapshotId, sourceUrl.  
Output: `{ weeks: MeasuredWeek[], rejectedRows: number }`.

Algorithm mirrors `parse-trend.ts`; uses `aggregate-v1` schema. `w_avg`, `min`, `max`, `populationcoverage` are parsed as `number | null` (empty string or `NA` → `null`).

---

## 7. Snapshot store (`src/server/ingest/snapshot-store.ts`)

```
storeSnapshot(rawBytes, meta) → { snapshotId, isNew }
```

1. Compute `snapshotId = sha256Hex(rawBytes)`.
2. Check if `data/snapshots/<snapshotId>.csv` exists → if yes, return `{ isNew: false }` (idempotent).
3. Write `data/snapshots/<snapshotId>.csv` (raw bytes).
4. Write `data/snapshots/<snapshotId>.meta.json` (SourceSnapshot with `status: "valid"`).
5. Return `{ snapshotId, isNew: true }`.

Rejected files: write `data/snapshots/<snapshotId>.rejected.json` for diagnostics; no `.csv` written.

---

## 8. Normalized JSON build (`scripts/ingest.ts` — build step)

After a valid trend snapshot is stored:

1. Load `StatusObservation[]` from the snapshot.
2. Write `data/normalized/trend-latest.json` (all observations).
3. Write per-location history JSON under `data/normalized/history/<locationId>-<pathogen>.json` from aggregate data. Each file contains only the rows for that location+pathogen, keeping files small.
4. Append to / update `data/normalized/index.json` with the new `SourceSnapshot` entry.

The 63 k-row aggregate is never written to a single browser-accessible file.

---

## 9. API routes

All routes live under `src/app/api/`. Each route handler:

- Reads normalized JSON from disk (no DB, no network calls).
- Validates query parameters with Zod; returns 400 on invalid params.
- Returns 404 when a `locationId` is not found.
- Every successful response envelope:

```ts
{
  snapshotId: string;
  sampleWeek: string;        // latest weekStart in the payload
  sourceUrl: string;
  data: T;
}
```

### `GET /api/locations`
Returns all unique locations from `trend-latest.json`, including `coverage` status (derived, not hardcoded) and `provinceAggregate` for uncovered cities.

### `GET /api/observations?locationId&pathogen&from&to`
Filters `StatusObservation[]` by params. `from`/`to` are optional ISO dates. Returns the filtered array in the response envelope.

### `GET /api/status?locationId`
Returns the latest `StatusObservation` for each pathogen at the requested location. If the location has no city-level row, returns `coverage: "no_city_site"` and includes any matching province aggregate.

### `GET /api/data-status`
Returns: last successful fetch time, snapshot count, `latestSampleWeekByPathogen`, schema version.

### `GET /api/snapshots`
Returns the full `index.json` content.

---

## 10. Wayback backfill (`scripts/wayback-backfill.ts`)

**Gate:** only run after ING-2 → ING-7 pass.

1. Call the Wayback CDX API:  
   `https://web.archive.org/cdx/search/cdx?url=health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv&output=json&fl=timestamp,original,statuscode&filter=statuscode:200`
2. For each capture, construct the Wayback URL: `https://web.archive.org/web/<timestamp>if_/<original>`.
3. Use `fetchWithCache` with Wayback-specific timeout (60 s — slower mirrors).
4. Validate and store via the same schema-registry + snapshot-store pipeline.
5. In `SourceSnapshot`: `origin: "wayback"`, `archivedAt: <ISO from CDX timestamp>`.
6. Skip captures whose `snapshotId` already exists in `data/snapshots/`.

`weekStart` values come only from file content, never from `archivedAt`.

---

## 11. Property tests (`tests/properties/ingestion.property.test.ts`)

| ID | Property | Approach |
|---|---|---|
| P1 | Changing `fetchedAt` never changes freshness label. | `fc.date()` → mutate `fetchedAt` → assert `computeFreshness` unchanged |
| P2 | Missing/NA rows → never `low` or `not_detected`. | `fc.constantFrom("NA1","NA2","")` → parse → assert activity |
| P4 | Re-ingesting same file is idempotent. | Run `storeSnapshot` twice → same `snapshotId`, one file on disk |
| P5 | `/api/observations` results always match requested pathogen+grouping. | `fc.constantFrom(pathogens)` → filter → assert all rows match |
| P6 | `activityIndex` always equals source `Viral_Activity_Level`. | `fc.constantFrom(sourceValues)` → parse → compare fields |
| P7 | Known header permutations accepted, unregistered renames rejected. | `fc.shuffledSubarray(knownHeaders)` (full set) + rename test |

Fixtures labelled with `// Retrieved: 2026-10-31` comment. Synthetic fixtures have `synthetic` in the filename.

---

## 12. Assumptions and field-level documentation

| # | Assumption | Evidence / source |
|---|---|---|
| A1 | Trend file contains one row per `Location × measureid` (latest week only). | BUILD_PLAN §6 table; audit trail §15 |
| A2 | `grouping ∈ {Site, City, Province, Canada}` — no other values in current file. | BUILD_PLAN §6 |
| A3 | `weekStart` in the trend file uses ISO format `YYYY-MM-DD`. | Build plan §6, L8 |
| A4 | Ottawa has no `grouping = City` row in the Oct 2026 snapshot; Ontario province row covers it. | BUILD_PLAN §15, §0 table row 5 |
| A5 | `NA1` may coexist with a valid `latestLevel` (Fredericton fluA pattern). | BUILD_PLAN §0 row 7 |
| A6 | Aggregate file has no `Viral_Activity_Level` or `latestTrend` columns — only `w_avg`, `min`, `max`. | BUILD_PLAN §6 verified file facts |
| A7 | Historical `min`/`max` in the aggregate are extremes across all recorded EpiWeeks, not confidence intervals. | BUILD_PLAN §0 row 1, review amendments |
| A8 | PHAC publishes aggregates only at ≥50% population coverage (≥75% national). Missing aggregate ≠ "not detected". | BUILD_PLAN §15, L3 |
| A9 | Schema drift is real: Dec 2025 trend file had `t_low, t_high`; Oct 2026 has `min, max`. | BUILD_PLAN §0 row 3 |
| A10 | Discontinued sites (listed in BUILD_PLAN §15) appear in history but may not appear in the latest trend snapshot. | BUILD_PLAN §15 |

All field names documented above match the verified Oct 2026 header row from BUILD_PLAN §6. The data dictionary at `https://health-infobase.canada.ca/src/data/covidLive/wastewater/covid19-wastewater-data-dictionary-en.csv` must be fetched and cross-checked during initial implementation.
