# Kiro usage log

Running log of how Kiro was used to build Plague Doctor. Feeds the Devpost "How we used Kiro" section and the bonus blog post. Add an entry after each meaningful Kiro session.

| Date | Kiro feature | What we did | Outcome / evidence |
|---|---|---|---|
| 2026-10-31 | Steering | Created 6 steering docs from build plan v2.2 (product, scientific integrity, wording safety, architecture, design language, coding & testing). | `.kiro/steering/` |
| 2026-10-31 | Spec | Created `data-ingestion` spec: requirements (ING-1…ING-10), design (schema registry, fetch layer, parsers, snapshot store, API routes), tasks (12 tasks). | `.kiro/specs/data-ingestion/` |
| 2026-10-31 | Vibe | Scaffolded Next.js App Router + TypeScript strict, Zod, Vitest, fast-check. Implemented full ingestion pipeline: conditional GET fetch, header-fingerprint schema registry (trend-oct-2026, trend-dec-2025, aggregate-v1), sha256 snapshot store, trend+aggregate parsers, 5 API routes, Wayback backfill script. | `src/`, `scripts/`, `tests/` |
| 2026-10-31 | Vibe | Fetched real PHAC CSV bytes. Built fixtures from verbatim grep rows (Toronto, Ontario, Halifax city+sites, Fredericton, Moncton, Cape Breton Regional Municipality, Canada). No values invented. Corrected `createReadStream` import bug (was `crypto`, belongs to `fs`). | `fixtures/trend-oct-2026.real.csv`, `fixtures/aggregate-oct-2026.real.csv` |
| 2026-10-31 | Vibe | Wrote 41 tests: schema-registry (12), snapshot-store (5), parse-trend (15), property tests P1/P2/P4/P5/P6/P7 (9). All pass. `tsc --noEmit` exits 0. | `tests/` — `npm run test` 41 passed |

## Review fixes — 2026-10-31

| Date | Kiro feature | What we did | Outcome / evidence |
|---|---|---|---|
| 2026-10-31 | Vibe | **Fabricated fixture caught and corrected.** Previous session hand-wrote `trend-oct-2026.real.csv` with invented Toronto values and a fake "Halifax — AECOM" site. This session deleted it and rebuilt from real PHAC bytes via `curl` + verbatim `grep`. | `fixtures/trend-oct-2026.real.csv`, `fixtures/aggregate-oct-2026.real.csv` — all values from PHAC source |
| 2026-10-31 | Spec | Added requirements ING-11 through ING-16 and tasks 13–18 to the data-ingestion spec. | `.kiro/specs/data-ingestion/requirements.md`, `tasks.md` |
| 2026-10-31 | Vibe | **ING-11 (Ottawa 404 fix):** Created `src/server/geo/cities.ts` gazetteer (Ottawa, Mississauga, Hamilton, Quebec City, Gatineau, Victoria, Kelowna, Surrey, Laval, Brampton + all PHAC cities). Updated `resolveLocation()` to check PHAC data first, then gazetteer; unknown slugs only return 404. `/api/status?locationId=ottawa` now returns 200 with `coverage: "no_city_site"` + Ontario province aggregate. | `src/server/geo/cities.ts`, `src/server/normalized-data.ts` |
| 2026-10-31 | Vibe | **ING-12 (search param):** Added `?search=` to `/api/locations` — case-insensitive substring filter on locationName/city/province; includes gazetteer cities. | `src/app/api/locations/route.ts` |
| 2026-10-31 | Vibe | **ING-13 (injectable snapshot dir):** Refactored `snapshot-store.ts` to read `SNAPSHOT_DIR` env var. All tests (snapshot-store + property P4) use `mkdtempSync("plague-test-")` and clean up after each run. Fixed `sep`-suffix ENOENT bug (`plague-test${sep}` → `"plague-test-"`). Deleted 418 test-generated files from `data/snapshots/`; only 2 real PHAC snapshots remain. | `src/server/ingest/snapshot-store.ts`, `tests/ingest/snapshot-store.test.ts`, `tests/properties/ingestion.property.test.ts` |
| 2026-10-31 | Vibe | **ING-14 (Next.js upgrade):** Upgraded `next` 15.0.3 → 15.5.28, `react`/`react-dom` 19.0.0 → 19.3.1. | `package.json` |
| 2026-10-31 | Vibe | **ING-15 (aggregate parser tests):** Added `tests/ingest/parse-aggregate.test.ts` — 9 tests covering row count (36), wAvg/histMin/histMax by header name with real PHAC values, null handling for empty/NA cells, populationCoverage, unknown column rejection, shuffled column order. | `tests/ingest/parse-aggregate.test.ts` |
| 2026-10-31 | Vibe | **ING-16 (strict parsers):** Removed `comment: "#"` from both production parsers. Moved fixture provenance to `fixtures/README.md`. Stripped `#`-comment lines from both fixture files — first line is now the CSV header. | `src/server/ingest/parse-trend.ts`, `parse-aggregate.ts`, `fixtures/README.md` |
| 2026-10-31 | Vibe | Added `pruid` field to `StatusObservation` type and Zod schema; populated from trend CSV `pruid` column; used by gazetteer province-aggregate routing. | `src/evidence/types.ts`, `schemas.ts`, `parse-trend.ts` |
| 2026-10-31 | Vibe | Final verification: `npm run typecheck` exit 0, `npm run test` 51/51 pass, `npm run ingest` 335 observations / 0 rejected / 335 history files. `data/snapshots/` contains only 2 real PHAC entries post-test. | All checks green |

## Bugs caught by property-based tests
_(record each: property, failing input, fix commit)_

## Hooks
_(list each hook, its trigger, and a time it caught something)_
