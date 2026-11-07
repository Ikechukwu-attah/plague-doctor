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
| 2026-10-31 | Specs (requirements-first) | Milestone 2 `evidence-engine`: Kiro Spec agent drafted EVD-1..9 via its requirements-first sub-agent (Autopilot off). Human review found 2 conflicts (wording guard banned the required phrase "not a prediction"; too-early cards both forbade and required current levels) + 8 gaps. Kiro's detailer and shell-write attempts stalled, so the reviewer applied the 10 review edits directly and added EVD-10 (prevention checklist). | `.kiro/specs/evidence-engine/requirements.md` |

| 2026-10-31 | Specs (design) | Kiro's spec sub-agent wrote `evidence-engine/design.md` (592 lines: module layout, types incl. separate NearStatement/HistoricalContext so too-early cards cannot carry current levels, Toronto-date strategy, 7 properties, real-fixture test plan). Reviewer approved with 5 adjustments (appended as §11). Kiro hit the free-plan rate limit ("using credits faster than your rate limit allows") — paused until the credit grant arrives. | `.kiro/specs/evidence-engine/design.md` |
| 2026-11-03 | Specs (tasks) + spec-task-execution | Milestone 2 `evidence-engine` implementation. Kiro wrote `tasks.md` (13 tasks, 12-wave dependency graph) then executed it wave-by-wave via spec-task-execution sub-agents (Autopilot). Built 8 pure modules in `src/evidence/` (card-types, date-utils, freshness, coverage, timing, wording-guard, card, share, diff + copy/checklist) and 8 test files in `tests/evidence/`, all using real PHAC fixtures parsed via the ingestion parsers. Applied design §11 adjustments (human-readable dates, `isGazetteerCity` param, Sunday-on-or-before EpiWeek matching, `% chance` regex, Halifax Christmas = 2026-12-25). | `src/evidence/`, `tests/evidence/` — `npx tsc --noEmit` exit 0, `npx vitest run` 111/111 pass |
| 2026-11-03 | Hooks | Recreated the 3 `.kiro/hooks/*.json` files in Kiro's native format (`version: v1`, `trigger: PostFileSave`, `matcher` regex, `action.command`) so they appear in the Agent Hooks panel. Earlier draft used a non-native `events`/`pathPatterns`/`steps` shape. | `.kiro/hooks/evidence-engine.json`, `wording-guard.json`, `ingestion-watch.json` |
| 2026-11-03 | Verification | Final: `npx tsc --noEmit` exit 0; `npx vitest run` 13 files / 111 tests pass (51 ingestion + 60 evidence). All 7 required properties green: P1 (freshness ignores ingest time), P2 (NA/missing never low/not_detected), P3 (too_early = zero publisher statements), P6 (activityIndex verbatim), P8 (share text excludes attendees), P10 (diff never says increase/decrease), P11 (attendees never serialized). | `npm run test` 111 passed |
| 2026-11-04 | Review fix (independent review) | Independent review caught an honesty bug: an Ottawa card's share text presented Ontario's provincial values under "Plague Doctor — Ottawa" with no regional label (EVD-2.10/EVD-4.7). Fixed with `regional`/`regionLocationName` on NearStatements plus an explicit "No Ottawa monitoring site — showing Ontario provincial aggregate (PHAC), not Ottawa" notice and per-line "(Ontario provincial aggregate)" labels. Also corrected the historical source URL to the aggregate CSV and labelled historical ranges as PHAC units. | `src/evidence/card.ts`, `share.ts`, `tests/evidence/` — 116 tests pass |

## Bugs caught by property-based tests
**EVD-1 P1 (freshness) + EVD-2 (coverage) — empty fixture parse via invalid snapshotId.**
- **Property:** `EVD-1 P1: freshness never depends on ingest time — oct-2026 fixture`, which runs `fc.constantFrom(...realObservations)` over observations parsed from the real PHAC trend fixture.
- **Failing symptom:** fast-check threw `fc.constantFrom expects at least one parameter` — the observation array was empty.
- **Root cause:** the test's `parseTrend(...)` call passed a short placeholder snapshotId (`"test-snapshot-id"`). `StatusObservationSchema` requires a 64-char sha256 hex string, so Zod rejected every parsed row, silently yielding zero observations. The property surfaced a real validation contract that a plain unit test would have masked.
- **Fix:** tests now pass a valid 64-char hex snapshotId (`"0".repeat(64)`). This supplies only a well-formed snapshot identifier; all observation values still come from the real PHAC fixture bytes. The same fix was applied to `coverage.test.ts`, `card.test.ts`, `share.test.ts`, `diff.test.ts`, and `card-privacy.test.ts`.
- **Takeaway:** the schema's snapshotId length contract is now exercised by every evidence test that parses a fixture; an invalid id can no longer produce a silently-empty dataset.

**Caught by independent review, not by a property — regional values shown as a city's.**
- **Bug:** for an uncovered city (Ottawa), `buildCard` filled the per-virus statements with Ontario's provincial aggregate and `generateShareText` printed them under "Plague Doctor — Ottawa" with no regional label, which reads as Ottawa data (EVD-2.10/EVD-4.7).
- **Why P6/P8 missed it:** P6 only checks that `activityIndex` equals the source `Viral_Activity_Level` (it did, for Ontario's row), and P8 only checks that attendee categories do not leak. Neither asserts that regional values are labelled as regional.
- **Tests added (example-based):** `EVD-4.7` Ottawa statements are marked `regional` with `regionLocationName` Ontario, Toronto's are not; `EVD-2.10/EVD-4.7` Ottawa share text carries the notice line and every virus line says "Ontario provincial aggregate".
- **Suggested follow-up property:** for any uncovered city, regional values never appear in share text without the region name on the same line.

## Hooks
| Hook file | Trigger | Matcher | Runs |
|---|---|---|---|
| `evidence-engine.json` | PostFileSave | `src/evidence/.*\.(ts\|tsx)$` | `npx vitest run tests/evidence` |
| `wording-guard.json` | PostFileSave | `(src/evidence/copy/.*\|src/.*\.tsx)$` | `npx vitest run tests/evidence/wording-guard.test.ts` |
| `ingestion-watch.json` | PostFileSave | `(src/server/ingest/.*\|fixtures/.*)$` | `npx vitest run tests/ingest tests/properties` |

All three use Kiro's native hook schema and appear in the Agent Hooks panel.

## Milestone 3 — UI build

| Date | Kiro feature | What we did | Outcome / evidence |
|---|---|---|---|
| Milestone 3 | Specs (requirements-first) | UI spec built requirements-first. Decisions recorded: D1 history served through a route (not shipped to the browser as bulk data); D2 map uses Natural Earth points; P1 index fix; P2 EpiYear fix. User approved clarifications C1–C24 before implementation. | `.kiro/specs/` UI spec (UI-* requirements) |
| Milestone 3 | spec-task-execution | Tasks executed by parallel sub-agents. | See deviations below |

### Final gate results
- `tsc --noEmit`: clean
- `vitest`: 45 files / 398 tests (116 original + 282 new)
- `next build`: ok, `/` = 163 kB First Load JS
- Playwright: 57 passed / 18 skipped

### Real bugs caught by tests during Milestone 3
1. **`buildHistoricalContext` ignored `epiYear`.** It took the first EpiWeek match, so past-event cards showed another year's `wAvg`. Caught by `tests/evidence/card-past-epiyear.test.ts` (UI-18.6, UI-18.7). Fix: match on epiYear + epiWeek (decision P2).
2. **`dateToEpiWeek` used first-Sunday numbering.** MMWR/CDC week 1 is the week whose Sunday falls on or before Jan 4. The old logic was off by one in 2024 and 2025. Found by the real-history test, not by a synthetic one.
3. **Test index pollution.** Ingestion tests wrote about 356 `example.com` entries to `data/normalized/index.json` and left `rowCount` 0 on real entries. Covered by `tests/ingest/normalized-isolation.test.ts` and `tests/ingest/index-clean.test.ts` (UI-18.3, UI-18.4, UI-18.5). Fix: isolated output dir for tests, index repaired (P1).
4. **Playwright / axe findings:**
   - City row `aria-label` did not match visible text (`label-content-name-mismatch`).
   - Omen Card mono text failed contrast.
   - Reduced-motion transition was `0.001ms` instead of `0`.
   - Map marker hit areas overlapped. Marker spacing relies on the WCAG 2.5.8 equivalent-list exception (every city is also reachable from the list). This is documented, not a pass on target size.
5. **d3-geo winding bug in `build-geometry`.** RFC 7946 counter-clockwise rings made d3-geo treat them as the whole sphere, which collapsed the projection. Fixed by rewinding the rings.
6. **`checkWording` flagged "endorsed by PHAC".** That forced a reworded non-endorsement statement. The comparison text "does not mean no infections" was also reworded (C10).

### Deviations and process notes
- Parallel sub-agents corrupted several files written through shell heredocs. Those files were rewritten with file tools. `DesignSystem.module.css` had to be rewritten.
- `ingest` ran twice in task 1.3. This deviated from the plan.
- The live PHAC schema is `trend-dec-2025`. Fixtures are `oct-2026`. Both are handled by the schema registry.

### Manual / unverified
- Lighthouse LCP not measured.
- Screen-reader pass not done.
- Visual fidelity against `design/*.dc.html` not verified.
- Wikipedia citations for 3 approximate city overrides not fetched.
- PHAC reuse-licence wording not confirmed.
