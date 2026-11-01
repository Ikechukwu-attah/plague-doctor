# Data Ingestion — Tasks

**Spec:** data-ingestion  
**Prefix:** ING  

---

## Task 1 — Scaffold Next.js project (ING-1)

- [ ] `npx create-next-app@latest` with App Router, TypeScript, no Tailwind yet (added in UI milestone), no ESLint custom config beyond defaults
- [ ] Set `tsconfig.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`
- [ ] Install runtime deps: `zod`, `csv-parse`, `papaparse` (or stick to `csv-parse`)
- [ ] Install dev deps: `vitest`, `@vitest/coverage-v8`, `fast-check`, `tsx`
- [ ] Add scripts to `package.json`: `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`, `"ingest": "tsx scripts/ingest.ts"`
- [ ] Create `vitest.config.ts` pointing at `tests/`
- [ ] Create directory skeletons: `src/server/ingest/`, `src/evidence/`, `data/snapshots/`, `data/normalized/`, `data/normalized/history/`, `fixtures/`, `scripts/`, `tests/ingest/`, `tests/properties/`
- [ ] Add `data/snapshots/` and `data/normalized/` to `.gitignore` (raw snapshots are large; only normalized committed)
- [ ] Verify: `npm run typecheck` and `npm run test` exit 0

---

## Task 2 — Core types and Zod schemas (ING-5 types)

- [ ] Create `src/evidence/types.ts` with all types verbatim from design §3
- [ ] Create `src/evidence/schemas.ts` with Zod schemas derived from those types
- [ ] Export `StatusObservationSchema`, `MeasuredWeekSchema`, `SourceSnapshotSchema`
- [ ] Verify: `npm run typecheck` exits 0

---

## Task 3 — Schema registry (ING-3)

- [ ] Create `src/server/ingest/schema-registry.ts`
- [ ] Implement `fingerprintHeaders(headers: string[]): string` (SHA-256 of sorted lowercased pipe-joined names)
- [ ] Register the three schemas (`trend-oct-2026`, `trend-dec-2025`, `aggregate-v1`) with their required columns
- [ ] Implement `detectSchema(fileType: "trend" | "aggregate", actualHeaders: string[]): SchemaVersion | null`
- [ ] Write unit test `tests/ingest/schema-registry.test.ts`:
  - Known headers in order → correct schema ID
  - Known headers reordered → same schema ID
  - One column renamed → `null`
  - Extra unexpected column → `null`
  - Dec-2025 headers → `trend-dec-2025`
- [ ] Verify: tests pass

---

## Task 4 — Fetch layer (ING-2)

- [ ] Create `src/server/ingest/fetch.ts`
- [ ] Implement `fetchWithCache(url, opts)`: reads ETag cache, sends conditional GET, enforces timeout (AbortController), enforces size limit
- [ ] Implement ETag/Last-Modified cache in `data/snapshots/etag-cache.json`
- [ ] Return typed `FetchResult = { status: "fetched"; bytes: Buffer; headers: ... } | { status: "not-modified" } | { status: "error"; reason: string }`
- [ ] Write unit tests with a mock HTTP server (use `vitest` + `undici` mock or `msw`):
  - 200 response → returns bytes
  - 304 response → `not-modified`
  - Timeout → throws `FetchTimeoutError`
  - Response exceeds size limit → aborts + error
  - Sends `If-None-Match` header on second call
- [ ] Verify: tests pass

---

## Task 5 — Snapshot store (ING-4)

- [ ] Create `src/server/ingest/snapshot-store.ts`
- [ ] Implement `storeSnapshot(rawBytes, meta)` with sha256 idempotency check
- [ ] Implement `writeRejected(snapshotId, reason, meta)` for rejected files
- [ ] Implement `loadLatestValidSnapshot(fileType)` — reads `index.json`, returns newest valid snapshot metadata
- [ ] Write unit tests `tests/ingest/snapshot-store.test.ts`:
  - First store → `isNew: true`, file written
  - Second store (same bytes) → `isNew: false`, no overwrite
  - Rejected file → no `.csv` written, `.rejected.json` written
- [ ] Verify: tests pass

---

## Task 6 — Trend parser (ING-5)

- [ ] Create `src/server/ingest/parse-trend.ts`
- [ ] Implement `parseTrend(bytes, schemaVersion, snapshotId, sourceUrl)` → `{ observations, rejectedRows }`
- [ ] Implement all value mapping tables from ING-5 (Activity, Direction, Grouping, Pathogen)
- [ ] Handle NA1 + valid latestLevel coexistence
- [ ] Implement `slugify(location: string): string` for deterministic `locationId`
- [ ] Write unit tests `tests/ingest/parse-trend.test.ts` using real trimmed fixture `fixtures/trend-oct-2026.real.csv`:
  - Standard row → correct normalized values
  - NA1 row → `activityIndex = unknown / na1_new_site`, `signalLevel` still parsed
  - NA2 row → `activityIndex = unknown / na2_not_sampling`
  - No Recent Data trend → `trend = unknown`
  - Malformed row → `rejectedRows++`, not in output
  - Toronto row → correct `activityIndex` matches actual file value
- [ ] Verify: tests pass

---

## Task 7 — Aggregate parser (ING-5 / ING-6)

- [ ] Create `src/server/ingest/parse-aggregate.ts`
- [ ] Implement `parseAggregate(bytes, snapshotId, sourceUrl)` → `{ weeks, rejectedRows }`
- [ ] Parse `w_avg`, `min`, `max`, `populationcoverage` as `number | null` (empty / `NA` → `null`)
- [ ] Write unit tests using real trimmed fixture `fixtures/aggregate-oct-2026.real.csv`
- [ ] Verify: tests pass

---

## Task 8 — Ingestion script and normalized JSON build (ING-6)

- [ ] Create `scripts/ingest.ts` as the CLI entrypoint
- [ ] Orchestrate: fetch trend → detect schema → store snapshot → parse → write normalized JSON
- [ ] Orchestrate: fetch aggregate → detect schema → store snapshot → parse → write per-location history JSON
- [ ] Write `data/normalized/trend-latest.json` after trend ingestion
- [ ] Write `data/normalized/history/<locationId>-<pathogen>.json` from aggregate
- [ ] Append/update `data/normalized/index.json`
- [ ] On schema mismatch: log error, keep last valid snapshot, exit with code 1 (CI alert)
- [ ] Run live: `npm run ingest` must complete successfully and produce `data/normalized/trend-latest.json`
- [ ] Verify: file exists, is valid JSON, contains `snapshotId` and `weekStart` on all records

---

## Task 9 — API routes (ING-7, ING-8)

- [ ] Create `src/app/api/locations/route.ts` — derive coverage status from snapshot, include provinceAggregate for uncovered cities
- [ ] Create `src/app/api/observations/route.ts` — Zod-validate query params, filter observations
- [ ] Create `src/app/api/status/route.ts` — latest observation per pathogen; `coverage: "no_city_site"` + province aggregate for Ottawa
- [ ] Create `src/app/api/data-status/route.ts` — ingestion health
- [ ] Create `src/app/api/snapshots/route.ts` — return `index.json`
- [ ] All responses include `snapshotId`, `sampleWeek`, `sourceUrl` envelope
- [ ] Zod-validate all query params; 400 on invalid; 404 on unknown locationId
- [ ] Manual check: `curl http://localhost:3000/api/locations` returns JSON array
- [ ] Manual check: `curl "http://localhost:3000/api/status?locationId=<ottawa-id>"` returns `coverage: "no_city_site"`
- [ ] Manual check: Toronto location returns its real `activityIndex`, `trend`, `weekStart`, `sourceUrl`

---

## Task 10 — Property-based tests (ING-10)

- [ ] Fetch real PHAC fixture bytes and save as `fixtures/trend-oct-2026.real.csv` (trimmed, labelled `// Retrieved: 2026-10-31`)
- [ ] Fetch Dec-2025 fixture and save as `fixtures/trend-dec-2025.real.csv`
- [ ] Fetch aggregate fixture and save as `fixtures/aggregate-oct-2026.real.csv`
- [ ] Create `tests/properties/ingestion.property.test.ts`
- [ ] Implement P1: `fc.date()` mutates `fetchedAt` → freshness unchanged
- [ ] Implement P2: `fc.constantFrom("NA1","NA2","")` → parsed activity never `low`/`not_detected`
- [ ] Implement P4: `fc.bytes()` (fixed real CSV) → two runs of `storeSnapshot` → same snapshotId, one file
- [ ] Implement P5: `fc.constantFrom(pathogens)` → `/api/observations` → all rows match pathogen
- [ ] Implement P6: `fc.constantFrom(sourceValues)` → parsed `activityIndex` matches source field
- [ ] Implement P7: `fc.shuffledSubarray(knownHeaders, {minLength: n, maxLength: n})` full permutation → identical output; one renamed header → rejection
- [ ] All test names include requirement ID (e.g., `"ING-10/P1: ..."`)
- [ ] Verify: `npm run test` exits 0, all 6 property tests green

---

## Task 11 — Wayback backfill (ING-9) [post-live-gate]

**Only begin after Tasks 8 and 9 are verified with a live PHAC snapshot.**

- [ ] Create `scripts/wayback-backfill.ts`
- [ ] Call Wayback CDX API for `wastewater_trend.csv` captures
- [ ] For each capture: fetch → schema-detect → store with `origin: "wayback"`, `archivedAt`
- [ ] Skip already-stored snapshotIds (idempotency)
- [ ] Test idempotency: run twice → same snapshot set
- [ ] Verify: each wayback snapshot has `origin: "wayback"` and distinct `archivedAt` vs `weekStart`

---

## Task 12 — Final verification (ING-1 acceptance)

- [ ] `npm run typecheck` exits 0 (no TypeScript errors)
- [ ] `npm run test` exits 0 (all unit + property tests pass)
- [ ] `npm run ingest` completes with at least one valid live PHAC snapshot
- [ ] `GET /api/locations` returns ≥ 1 location with `snapshotId` and `sampleWeek`
- [ ] `GET /api/status?locationId=<toronto-id>` returns Toronto's real `activityIndex`, `trend`, `weekStart` from the live snapshot
- [ ] `GET /api/status?locationId=<ottawa-id>` returns `coverage: "no_city_site"` with Ontario aggregate (if present)
- [ ] Log this session in `docs/KIRO_USAGE.md`

---

## Task 13 — City gazetteer (ING-11)

- [x] Create `src/server/geo/cities.ts` with `GazetteerCity` type and `GAZETTEER` map (slug → city entry)
- [x] Include all PHAC-present city slugs + Ottawa, Mississauga, Hamilton, Quebec City, Gatineau, Victoria, Kelowna, Surrey, Laval, Brampton
- [x] Update `src/server/normalized-data.ts`: `resolveLocation(locationId, observations)` — checks PHAC data first, falls back to gazetteer, returns null only if neither knows the slug
- [x] Update `/api/status` to use `resolveLocation` — return 200 with `coverage: "no_city_site"` for gazetteer cities not in PHAC
- [x] Verify: `GET /api/status?locationId=ottawa` → 200 + `coverage: "no_city_site"` + Ontario provinceAggregate

---

## Task 14 — Search on /api/locations (ING-12)

- [x] Add optional `?search=` param to `/api/locations` route (Zod-validated)
- [x] Apply case-insensitive substring filter on `locationName`, `city`, `province`
- [x] Include gazetteer cities in location list (coverage `no_city_site`)
- [x] Verify: `?search=ott` returns Ottawa; `?search=` (empty) returns all

---

## Task 15 — Injectable snapshot directory (ING-13)

- [x] Refactor `snapshot-store.ts`: extract `getSnapshotsDir()` that reads `process.env.SNAPSHOT_DIR ?? join(process.cwd(), "data", "snapshots")`; same for index path
- [x] Update `storeSnapshot`, `writeRejected`, `loadIndex`, `loadSnapshotBytes`, `loadSnapshotMeta` to use the injectable dir
- [x] Rewrite `tests/ingest/snapshot-store.test.ts` to use `mkdtemp` + `SNAPSHOT_DIR` env var; clean up temp dir in `afterEach`
- [x] Delete all test-generated files from `data/snapshots/` (keep only real PHAC snapshots)
- [x] Verify: after `npm run test`, `data/snapshots/` contains only real PHAC `.meta.json` entries

---

## Task 16 — Upgrade Next.js + React (ING-14)

- [x] Update `package.json`: `next` → `15.5.28`, `react` + `react-dom` → `19.3.1`
- [x] Run `npm install`
- [x] Verify: `npm run typecheck` and `npm run test` pass

---

## Task 17 — Aggregate parser tests (ING-15)

- [x] Create `tests/ingest/parse-aggregate.test.ts`
- [x] Test: 36 data rows parsed (20 Toronto + 16 Halifax)
- [x] Test: Toronto covN2 wAvg, histMin, histMax are numbers matched by header name
- [x] Test: empty cell → `null`, not zero
- [x] Test: populationCoverage parsed correctly
- [x] Test: unknown column in header → schema `detectSchema` returns null
- [x] Verify: tests pass

---

## Task 18 — Remove comment option; clean fixtures (ING-16)

- [x] Remove `comment: "#"` from `parseTrend` and `parseAggregate`
- [x] Remove `#`-comment lines from `fixtures/trend-oct-2026.real.csv` and `fixtures/aggregate-oct-2026.real.csv`
- [x] Create `fixtures/README.md` with full provenance (source URL, Last-Modified, retrieval date, locations, grep method)
- [x] Verify: all tests still pass
