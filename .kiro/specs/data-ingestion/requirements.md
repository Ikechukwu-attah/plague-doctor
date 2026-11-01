# Data Ingestion — Requirements

**Spec:** data-ingestion  
**Prefix:** ING  
**Scope:** Ingestion pipeline and read path only — no UI.  
**Source of truth:** `docs/BUILD_PLAN.md` v2.2; all steering docs in `.kiro/steering/`.

---

## ING-1 — Project scaffold

The repository must be a Next.js App Router project with TypeScript strict mode, Zod, Vitest, and fast-check installed.  
A `tsconfig.json` must have `"strict": true` and `"noUncheckedIndexedAccess": true`.  
A `vitest.config.ts` must be configured for the project.  
A root `package.json` must include scripts: `dev`, `build`, `typecheck`, `test`.

**Acceptance:** `npm run typecheck` and `npm run test` both exit 0 on a fresh checkout (after `npm install`).

---

## ING-2 — Fetch PHAC CSVs server-side

The ingestion script must fetch the following two files server-side only (never from the browser):

- Trend: `https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv`
- Aggregate: `https://health-infobase.canada.ca/src/data/wastewater/wastewater_aggregate.csv`

Each request must:
- Use a conditional GET with `If-None-Match` (ETag) and `If-Modified-Since` (Last-Modified) from the previous fetch, if available. A 304 response is a no-op.
- Enforce a request timeout (configurable, default 30 s).
- Enforce a response size limit (configurable, default 20 MB) and abort if exceeded.
- Record `fetchedAt` (ISO timestamp), `lastModified` (from response header), and `etag` (from response header) in the snapshot metadata.

**Acceptance:** A second fetch of the same unchanged file returns 304 and produces no new snapshot.

---

## ING-3 — Header-fingerprint schema registry

The ingestion module must read the actual CSV header row of each fetched file before any value mapping.  
It must not assume column positions; all values must be accessed by header name.

A schema registry must be implemented that contains at minimum:

| Schema ID | File | Headers that define it |
|---|---|---|
| `trend-oct-2026` | trend | `Location, measureid, latestTrend, pruid, min, max, latestLevel, grouping, city, province, country, Viral_Activity_Level, weekStart` |
| `trend-dec-2025` | trend | same as above but `t_low, t_high` instead of `min, max` |
| `aggregate-v1` | aggregate | `Location, site, city, province, country, EpiYear, EpiWeek, weekstart, measureid, w_avg, min, max, populationcoverage, pruid` |

A **header fingerprint** is a deterministic, order-independent hash of the required column names for a schema version.  
Reordered known columns must be accepted (same fingerprint, different order → still matches).  
Unknown, renamed, or removed required columns must cause the file to be rejected (fail closed).  
Extra unexpected columns must require explicit compatibility review (treated as unknown → reject).

The registry must be extensible: adding a new schema version must not require changing the parsing logic.

**Acceptance:** Feeding a CSV with reordered known headers produces identical normalized output. Feeding a CSV with a renamed required column is rejected and the last valid snapshot is kept.

---

## ING-4 — Immutable snapshot storage

Each valid, newly-seen source file must be stored as a raw copy under `data/snapshots/` using a file path keyed by the sha256 hex digest of the raw file bytes:

```
data/snapshots/<sha256>.csv
data/snapshots/<sha256>.meta.json
```

The `.meta.json` file must contain the `SourceSnapshot` structure defined in BUILD_PLAN §6.  
Ingestion is idempotent: if a file with the same sha256 already exists in `data/snapshots/`, the snapshot must not be re-created or overwritten.  
A rejected file must not be stored as a valid snapshot; a `.rejected.json` record may be written for debugging.

**Acceptance:** Running ingestion twice with the same remote file produces exactly one snapshot pair. Running ingestion with a file that fails schema validation produces no valid snapshot, and the previous valid snapshot remains unchanged.

---

## ING-5 — Value normalization

The parser must map PHAC source values to the internal normalized types defined in BUILD_PLAN §6:

| Source field | Internal field | Notes |
|---|---|---|
| `Viral_Activity_Level` | `activityIndex` | Headline everywhere |
| `latestLevel` | `signalLevel` | Secondary only |
| `latestTrend` | `trend` | See direction mapping below |
| `weekStart` | `weekStart` | ISO date string `YYYY-MM-DD` |

**Activity mapping** (`Viral_Activity_Level` and `latestLevel`):

| Source value | Internal `Activity` |
|---|---|
| `High` | `high` |
| `Moderate` | `moderate` |
| `Low` | `low` |
| `Non-detect` | `not_detected` |
| `NA1` | `unknown` + `unknownReason: "na1_new_site"` |
| `NA2` | `unknown` + `unknownReason: "na2_not_sampling"` |
| missing / empty | `unknown` + `unknownReason: "missing_row"` |

**Trend mapping** (`latestTrend`):

| Source value | Internal `Direction` |
|---|---|
| `Increasing` | `increasing` |
| `No Change` | `stable` |
| `Decreasing` | `decreasing` |
| `No Recent Data` | `unknown` |
| missing / empty | `unknown` |

**Grouping mapping** (`grouping`):

| Source value | Internal |
|---|---|
| `Site` | `site` |
| `City` | `city` |
| `Province` | `province` |
| `Canada` | `national` |

**Pathogen mapping** (`measureid`):

| Source value | Internal `Pathogen` |
|---|---|
| `covN2` | `covid19` |
| `fluA` | `fluA` |
| `fluB` | `fluB` |
| `rsv` | `rsv` |

`NA1` may coexist with a valid `latestLevel` (Fredericton fluA pattern): when `Viral_Activity_Level = NA1`, set `activityIndex = unknown / na1_new_site` but still parse `latestLevel` normally.

Rows that fail Zod validation must be counted as `rejectedRows` in the snapshot metadata and excluded from the normalized output. Each rejection must be logged.

**Acceptance:** A row with `Viral_Activity_Level = NA2` produces `activityIndex = unknown` with `unknownReason = "na2_not_sampling"`. A row with `Viral_Activity_Level = NA1` and `latestLevel = Moderate` produces `activityIndex.unknown + signalLevel = moderate`. Missing rows never produce `low` or `not_detected`.

---

## ING-6 — Normalized JSON build output

After a valid snapshot is stored, the build step must produce normalized JSON files under `data/normalized/`:

```
data/normalized/trend-latest.json      — all current StatusObservation records
data/normalized/aggregate-<sha256>.json — MeasuredWeek records for that snapshot
data/normalized/index.json             — list of snapshots with metadata
```

Each JSON file must embed `snapshotId`, the source URL, the schema version used, and `fetchedAt`.  
The 63 k-row aggregate history must never be shipped to the browser as a single file; the build step must emit one JSON per `locationId × pathogen` combination under `data/normalized/history/`.

**Acceptance:** `data/normalized/trend-latest.json` exists and is valid JSON after a successful ingestion run; every record has `snapshotId` and `weekStart` set.

---

## ING-7 — Read-path API routes

The following Next.js App Router route handlers must be implemented as read-only GET endpoints:

| Route | Response |
|---|---|
| `GET /api/locations` | All known locations (id, name, city, province, grouping, active) from latest valid snapshot |
| `GET /api/observations?locationId&pathogen&from&to` | `StatusObservation[]` filtered by params |
| `GET /api/status?locationId` | Latest `StatusObservation` for each pathogen at that location |
| `GET /api/data-status` | Ingestion health: last successful fetch time, snapshot count, latest sample week per pathogen |
| `GET /api/snapshots` | List of `SourceSnapshot` metadata records |

Every response body must include `snapshotId`, `sampleWeek` (the most recent `weekStart` in the payload), and `sourceUrl`.  
All route handlers must validate query parameters with Zod and return structured error responses (400 for bad params, 404 for unknown location).

**Acceptance:** `GET /api/locations` returns a JSON array with at least one entry after a successful ingestion run; `GET /api/status?locationId=<toronto-id>` returns non-empty data for the ingested snapshot.

---

## ING-8 — Coverage and "no site" logic

The ingestion pipeline must derive city-level coverage status from the current valid snapshot, never hardcoded.  
For any city that appears in a user request but has no `grouping = City` row in the trend file, the system must:

1. Return `coverage: "no_city_site"` for that location.
2. Look up the province-level aggregate row (`grouping = Province`) for the matching `pruid`.
3. If a province row exists, include it as `provinceAggregate` in the location response, clearly labelled.
4. If no province row exists, set `unknownReason: "aggregate_below_coverage"`.

Ottawa must return `coverage: "no_city_site"` with the Ontario provincial aggregate offered, if present in the snapshot.  
Coverage status must be recomputed with every valid snapshot update, never cached from a prior snapshot.

**Acceptance:** After ingesting the current PHAC trend file, `/api/status?locationId=ottawa` returns `coverage: "no_city_site"` and includes an Ontario provincial aggregate entry if one is present in the file.

---

## ING-9 — Wayback backfill script (post live-ingestion gate)

**This requirement is only attempted after ING-2 through ING-7 pass.**

A standalone script `scripts/wayback-backfill.ts` must:

1. Query the Wayback CDX API for archived captures of `wastewater_trend.csv`.
2. For each capture URL, fetch the archived file using the same conditional-GET + size-limit logic as ING-2.
3. Store each valid archived file under `data/snapshots/` exactly as ING-4, with `origin: "wayback"` and `archivedAt` set to the Wayback capture timestamp.
4. The `archivedAt` timestamp must never be used as the sample date; `weekStart` comes only from the file content.
5. The script must be idempotent: already-stored captures are skipped.
6. It must not modify existing live-origin snapshots.

**Acceptance:** Running the script once and re-running it produces the same set of snapshots. Each wayback snapshot has `origin: "wayback"` and a non-null `archivedAt` distinct from `weekStart`.

---

## ING-10 — Property-based tests

The following fast-check property tests (from BUILD_PLAN §8 and `coding-and-testing.md`) must pass, using trimmed real PHAC fixtures with their retrieval date:

| # | Property | Requirement |
|---|---|---|
| P1 | Changing only `fetchedAt`/ingest time never makes an old sample "Latest available". | ING-2, ING-5 |
| P2 | Missing/NA rows never yield `low` or `not_detected`. | ING-5 |
| P4 | Re-ingesting the same file is idempotent (same `snapshotId`, no duplicate rows). | ING-4 |
| P5 | Every returned record matches the requested pathogen and grouping. | ING-7 |
| P6 | Card `activityIndex` always equals the source `Viral_Activity_Level` (no re-classification). | ING-5 |
| P7 | Permutations of known header columns are accepted and produce identical normalized values; incompatible or unregistered column renames are rejected. | ING-3 |

Tests must use real PHAC fixtures (trimmed, labelled with retrieval date). Synthetic fixtures must be labelled `synthetic` in the filename.  
Test names must include the requirement ID (e.g., `ING-3: reordered headers`).

**Acceptance:** `npm run test` exits 0 with all six property tests green.

---

## ING-11 — City gazetteer for uncovered locations

A committed gazetteer at `src/server/geo/cities.ts` must map well-known Canadian city names to their province name and Statistics Canada `pruid`.

The gazetteer must include at minimum:
- All cities present in PHAC's trend CSV (Toronto, Halifax, Fredericton, Moncton, Cape Breton Regional Municipality, and any others in the live file).
- Ottawa, Mississauga, Hamilton, Quebec City, Gatineau, Victoria, Kelowna, Surrey, Laval, Brampton — cities commonly queried that have no PHAC monitoring site.

`GET /api/status?locationId=<slug>` must resolve a gazetteer city even if it has zero rows in the trend file. The response must be HTTP 200 with `coverage: "no_city_site"`, empty `observations: []`, and `provinceAggregate` populated from the matching PHAC Province row (if one exists in the latest snapshot). Only names not in the gazetteer AND not in the PHAC data return 404.

The gazetteer must never substitute another city's values. It only supplies province affiliation for routing to the correct province aggregate.

**Acceptance:** `GET /api/status?locationId=ottawa` returns 200 with `coverage: "no_city_site"` and a non-null `provinceAggregate` pointing to Ontario data (when Ontario rows are present in the snapshot).

---

## ING-12 — Search filter on /api/locations

`GET /api/locations` must support an optional `?search=` query parameter.

When provided, the response must be filtered to locations whose `locationName`, `city`, or `province` contain the search string as a case-insensitive substring.

Gazetteer cities (those with `coverage: "no_city_site"` and no PHAC rows) must be included in the results when they match the search string.

**Acceptance:** `GET /api/locations?search=ott` returns Ottawa (and any other matching locations) but not Alberta or unrelated provinces. An empty string or absent `search` returns all locations.

---

## ING-13 — Injectable snapshot directory for tests

`snapshot-store.ts` must accept the snapshot directory as an injectable parameter (or read from environment variable `SNAPSHOT_DIR`), defaulting to `data/snapshots/` relative to `process.cwd()`.

Tests must use `fs.mkdtemp` to create an isolated temporary directory, pass it to snapshot-store functions, and clean up after each test. No test output must accumulate in `data/snapshots/`.

**Acceptance:** After `npm run test`, `data/snapshots/` contains only files produced by `npm run ingest` (real PHAC snapshots), not test artifacts.

---

## ING-14 — Upgrade Next.js to latest patched 15.x

`next` must be upgraded to the latest stable 15.x release (≥ 15.1.0) that carries security patches for known 15.0.x advisories. `react` and `react-dom` must be upgraded to the matching stable peer version.

**Acceptance:** `npm run typecheck` and `npm run test` pass on the upgraded versions. `npm audit` shows no critical advisories attributable to Next.js 15.0.x.

---

## ING-15 — Aggregate parser tests

`tests/ingest/parse-aggregate.test.ts` must exist and cover:
- Row count matches expected fixture count (20 Toronto + 16 Halifax = 36 data rows).
- `wAvg`, `histMin`, `histMax` parsed as numbers by header name (not index).
- Empty cells and `NA` values produce `null`, not zero.
- `populationCoverage` parsed correctly.
- An unknown/extra column in the header causes schema detection to return `null` (fail closed at the ingest layer).
- Fixture used is `fixtures/aggregate-oct-2026.real.csv`.

**Acceptance:** `npm run test` passes the new parse-aggregate tests.

---

## ING-16 — Remove comment: "#" from production parsers; move fixture provenance to README

The `comment: "#"` option must be removed from `parseTrend` and `parseAggregate`. Live PHAC CSVs have no comment lines; the parser must be strict.

Fixture provenance (source URL, Last-Modified header, retrieval date, locations included, "rows copied verbatim via grep") must be documented in `fixtures/README.md` only.

The `#`-comment lines must be removed from `fixtures/trend-oct-2026.real.csv` and `fixtures/aggregate-oct-2026.real.csv` so that the first line of each file is the CSV header row.

**Acceptance:** `parseTrend` called on a fixture file that starts with `Location,…` (no comment lines) parses correctly. `parseTrend` called on a file with a `#`-prefixed first line rejects the entire file (no rows parsed), which correctly triggers a schema mismatch in the ingest pipeline.
