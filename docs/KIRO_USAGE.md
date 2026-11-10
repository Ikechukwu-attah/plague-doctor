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

## Task 15.7 — Landing LCP and performance

Tooling: Lighthouse 12.8.2, mobile defaults (simulated slow 4G, 4x CPU), against `next start` on a production build. Single runs vary by up to ~25 perf points on this machine (one run in five often lands a 1.5-2 s TBT spike from background load), so after-numbers are medians of 5 runs.

### Before
- Reported baseline: `/` perf 49, a11y 100, LCP 5.5 s (limitation `<p>`, TTFB ~0.6 s, render delay ~4.9 s), CLS 0.013, TBT 1750 ms, First Load JS 163 kB.
- Reproduced on the same commit (2 runs): perf 85-86, LCP 3.0-3.1 s, TBT 330-360 ms, CLS 0.057-0.068, First Load JS 164 kB. Render-blocking CSS: 2 files (6.6 KB, 3.0 KB), ~510 ms.

### Diagnosis (from the saved trace and audits)
- **The paragraph was never late in the browser.** In the trace, observed FCP = observed LCP ≈ 0.2 s. The h1 and limitation line were already in the server HTML (`src/app/page.tsx` is a server component, outside the Suspense boundary). The 3-5 s "render delay" is Lighthouse's *simulated* LCP. Lantern charges every request that starts before the observed LCP, simulated on slow 4G + 4x CPU. That covers the 2 render-blocking CSS files, 4 preloaded fonts (~117 KB), and every initial script chunk, including the 163 kB of route JS.
- **What was in that JS:** `LandingView` and everything below it were in the route's initial chunks: `CanadaMap`, 36 KB of projected province paths, `FogLayer`, `MapMarker`, `DetailSurface` → `CityDetail`, and Zod (~57 KB raw). Zod got in through the root layout: `ApiProvider` → `lib/api/client.ts`, so it loaded on every route. Script evaluation was ~700 ms, with long tasks of 165-190 ms in the shared chunks during hydration.
- **The LCP element in the reproduction was the footer `<p>`**, not the hero. While the data island showed a short skeleton, the footer sat high on the page as the largest text block. When the rows arrived it moved down, which caused the 0.057 CLS.
- **The fog is not a cost.** It is pure CSS animation on ~50 spans, which is compositor-only after paint. No polling, intervals or refetch loops exist (`grep setInterval|refetch` is empty).

### Fixes
1. `LandingIsland` (client) loads `LandingView` with `next/dynamic` (`ssr:false`). In parallel it loads the Zod-backed API client (`lib/api/client-impl.ts`), so the four reads are not one chunk later. The h1 and limitation line stay as plain server markup in `page.tsx`, outside any client wrapper or Suspense fallback. The text is unchanged.
2. `CanadaMap` (outlines, fog, markers) and `DetailSurface` (→ `CityDetail`) are `next/dynamic` chunks inside the island. `LandingScreen` takes the map as a `mapComponent` prop, so the presentational tests still render it statically. `CITY_LIST_ID` and `useDetailMode` moved to tiny modules (`landing-ids.ts`, `detail-mode.ts`), so the list and the view no longer pull in the map or detail chunks.
3. `lib/api/client.ts` is now a type-only facade that imports `client-impl` on the first request. Zod is gone from the root layout and from every route's first load.
4. `experimental.inlineCss`: the two render-blocking stylesheets are inlined. CSP already allows `style-src 'unsafe-inline'`.
5. Only Inter (the LCP paragraph's font) is preloaded. Cormorant and JetBrains Mono keep `display: swap` with `preload: false`. Dropping the Inter preload as well made FCP worse (1.4 s), so it stays.
6. The island's pending state reserves `70dvh`, so the footer is no longer the LCP candidate and does not jump when the rows arrive.

### After (`/`, median of 5)
| metric | before (reported) | before (reproduced) | after |
|---|---|---|---|
| Performance | 49 | 85-86 | **92** (85-95) |
| LCP | 5.5 s | 3.0-3.1 s | **2.4 s** (2.4-2.5) |
| TBT | 1750 ms | 330-360 ms | **280 ms** (190-500) |
| CLS | 0.013 | 0.057-0.068 | **0.01** |
| Render-blocking CSS | 2 files | 2 files, ~510 ms | **0** |
| LCP element | limitation `<p>` | footer `<p>` | limitation `<p>` |
| First Load JS `/` | 163 kB | 164 kB | **108 kB** |

Other routes (2 runs each, informational; 15.8 does the full pass): `/plan` 87-92 / LCP 2.9-3.0 s; `/methods` 85-92 / LCP 2.5-2.7 s (First Load JS 126 → 111 kB); `/city/toronto` 80-87 / LCP 2.6-2.8 s (First Load JS 137 → 123 kB). **`/city/toronto` shows CLS 0.168:** the site footer shifts when the city data replaces the loading state. This is not caused by 15.7, but it needs fixing in 15.8.

What is left in the simulated LCP is mostly the 103 kB of JS that Next shares across all routes (React + router), which every route requests before first paint.

### Real bugs found while doing this
1. **A11y bug hidden by timeouts: map marker label-in-name (WCAG 2.5.3).** Before this task, the axe "landing page" test always timed out on `networkidle` under parallel load, so it never got to run axe. Once it ran, axe reported `label-content-name-mismatch` (serious) on every labelled map marker. The visible label "Calgary · Moderate" was not contained in the accessible name "Calgary, fluA: Moderate, …". Fix in `lib/view/landing-rows.ts`: names now start with the visible text ("Calgary, Moderate, fluA, stable, week of …"; unknown: "X, no data, fluA, week of …"). No data semantics changed.
2. **The `networkidle` timeouts were load, not an endless request.** On an idle server `networkidle` settles in under 1 s (`/` 0.9 s, `/plan` 1.2 s). The Playwright trace of a failure showed static chunks taking 4.5 s and `/api/observations` 5.5 s, because several workers share one `next start` process. Nothing polls. `expect.timeout` was raised to 10 s in `playwright.config.ts` for data-dependent assertions.

### Tests added
- `tests/ui/landing-ssr.test.tsx`: the server markup contains the h1 and the unchanged limitation line before the loading placeholder. `page.tsx` has no `"use client"`, and the hero is not inside a client wrapper or Suspense. The island, map and detail surface are loaded with `next/dynamic`.
- `e2e/landing-ssr.spec.ts`: with JavaScript disabled, the h1 and limitation line are visible.

## Task 15.8 — Re-verification, before/after

Lighthouse 12.8.2, mobile defaults, median of 3 runs, production build (`next start`). Before = numbers recorded before group 15.

| Route | Perf | A11y | Best-practices | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| `/` before | 49 | 100 | 96 | 5.5 s | 0.013 | 1750 ms |
| `/` after | 93 | 100 | 100 | 2.39 s | 0.010 | 252 ms |
| `/plan` before | 78 | 100 | 96 | 3.2 s | 0 | 600 ms |
| `/plan` after | 95 | 100 | 100 | 2.74 s | 0 | 125 ms |
| `/methods` before | 89 | 100 | 96 | 3.0 s | 0 | 260 ms |
| `/methods` after | 94 | 100 | 100 | 2.38 s | 0 | 226 ms |
| `/city/toronto` before | 86 | 100 | 96 | 3.6 s | 0 | 220 ms |
| `/city/toronto` after | 90 | 100 | 100 | 2.55 s | 0.000 | 322 ms |

Run-to-run spread on `/` was 89 to 93 across two passes, so treat the LCP figures (2.4 to 2.5 s) as at the 2.5 s target, not clearly under it. The 0.168 CLS seen earlier on `/city/toronto` is fixed by reserving height on the city page container (`PageContainer` `city` variant, `min-height: 140vh`); it is a blunt reservation, not a measured skeleton height. Best-practices 100 on all four routes means the favicon 404 console error is gone (no `favicon.ico` route was needed).

| Check | Baseline | Now |
|---|---|---|
| vitest | 45 files / 398 tests | 51 files / 429 tests |
| Playwright (incl. axe) | 57 passed / 18 skipped | 64 passed / 20 skipped (skips are the project-conditional cases, no new exceptions) |
| `tsc --noEmit`, `npm run build` | pass | pass; First Load JS `/` 108 kB, `/city/[id]` 123 kB, `/plan` 136 kB |

Defects found in the screenshot pass and fixed: the drawer left a 77 px gap under a scrolled, non-sticky header (header now sticky at ≥ 1024 px); the provenance `i` stretched to a full-width pill in the mobile card grid (`justify-self: start`); no space between the planner intro and the stepper.

### Real bugs found in group 15

1. Provenance glyph colour equalled the paper colour on the parchment card, so the `i` was invisible. Fixed with per-surface tokens and a contrast test.
2. `.drawer` had no `position`, so it sat in document flow and shifted the map and list. Now `position: fixed`.
3. The fog `span` was `display: inline`, giving it zero size, so no glow rendered. Now a block layer.
4. Map marker visible label inside the accessible name (WCAG 2.5.3 Label in Name, axe serious). The `networkidle` timeouts had hidden it, and those timeouts were server load, not polling.
5. Footer layout shift on the city page when data replaced the loading state (CLS 0.168).

## Milestone 4

### What was added to the spec
Requirement 19 (review fixes and Costume Contest polish) plus task group 17 (items 17.1 to 17.13) and group 18 (follow-ups 18.1 to 18.5). Numbering note: `docs/MILESTONE_4_REVIEW_FIXES.md` calls the new group "group 16", but 16 ("Follow-ups") already existed, so it was recorded as group 17.

### Bugs found and fixed (with tests)
1. Map hit-target overlap: markers' 44 px boxes overlapped, so clicks went to the wrong place (for example Toronto opened london). Verified with `document.elementFromPoint` on the live site. Fixed by clustering (17.1). Tests: `tests/ui/map-clusters.test.ts`, `e2e/marker-hit.spec.ts` (1440 px and 390 px).
2. Card created date used `toISOString()` (UTC), so an evening in Toronto showed the next day. First fix used the Toronto calendar (17.2), then corrected to the viewer's local calendar date (18.2, `localDateParts` in `src/lib/clock.ts`). Tests: `tests/ui/card-created-date.test.tsx` (Toronto 2026-11-07T23:30-05:00 and Vancouver 22:30-08:00 both "Nov 7, 2026"), Property 24, `clock-scan`.
3. The 404 page had no padding. Now inside `PageContainer` (17.3). Tests: `tests/ui/page-container.test.tsx`, 390 px no-overflow check extended to `/nope`.
4. Vancouver showed "No monitoring site" although PHAC covers it as Metro Vancouver. Added a reviewed regional-site table with a citation per row (17.4). Only Vancouver could be verified from PHAC's own location and site names. Peel and Cape Breton were not added because the evidence was not verifiable. Tests: `tests/ui/regional-site.test.tsx`, `e2e/regional-site.spec.ts`.
5. Planner accepted a six-digit year. Now `min`/`max` and a validation message (17.5). Tests: `tests/ui/planner.test.ts`, `e2e/planner-date.spec.ts`.
6. The closed provenance `<dialog>` rendered its definitions into the DOM (about 16 copies per city page), which failed UI-12.6 in `tests/ui/screen-states.test.tsx`. The body now mounts only while open (18.1). Tests: `tests/ui/provenance-trigger.test.tsx`, UI-12.6 unchanged.
7. Build check found a per-route `og:image` override: a route-level `openGraph` object replaced the root one and dropped the image. Fixed in 18.3. Tests: `e2e/social-and-download.spec.ts`, `tests/ui/card-image.test.ts`.

### Before / after
Lighthouse mobile, median of 3, `/`:
| Run | Perf | LCP | CLS | TBT | First Load JS |
|---|---|---|---|---|---|
| Before M4 | 89 / 91 / 92 | 2.38 / 2.37 / 2.50 s | 0 to 0.01 | 391 / 324 / 257 ms | 108 kB |
| After M4 | 95 / 95 / 96 (median 95) | 2.35 / 2.39 / 2.31 s (median 2.35 s) | 0.01 / 0.01 / 0.01 | 183 / 209 / 153 ms (median 183 ms) | 109 kB |

Lighthouse 12.8.2, mobile defaults, performance category only, production build without the test clock. Gate (perf 90 or above, LCP 2.5 s or below) passed.

Unit tests at audit time: `tsc --noEmit` clean, vitest 59 files / 494 tests passing.

### Final gate counts (task 18.5)
- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 59 files / 494 tests passed, 0 failed.
- `npm run build`: no errors; First Load JS `/` 109 kB (shared 105 kB), `/methods` 112 kB, `/city/[locationId]` 127 kB, `/plan` 139 kB, `/card` 147 kB.
- `npx playwright test` (desktop, mobile, reduced-motion): 99 passed, 24 skipped, 0 failed after one fix.
- Defect caught by the full run: `e2e/marker-hit.spec.ts` (cluster chooser) assumed the map stays on screen after choosing a place. Below 768 px (UI-5.9) the app navigates to `/city/{id}`, so the mobile project failed. The test now asserts the city page URL and heading below 768 px and the map marker at 768 px and up. App code unchanged.
- `git diff --stat -- src/evidence` empty.

### Deviations and process notes
- The orchestrator's three parallel sub-agents were interrupted mid-run in M4 and task statuses were reset. Statuses were then reconciled against the code and tests (18.4).
- One e2e edit (`e2e/keyboard-and-viewport.spec.ts`) was made with a python one-liner instead of the file tools.
- Spec group numbering: doc "group 16" is group 17 here.
- The PNG card download was feasible (client-side SVG to canvas, no new dependency) and shipped in 18.3.

### Skipped / not done (audit of 17.6 to 17.12)
- 17.7 Bigger map and quieter markers: not implemented. No "Show places without data" toggle or URL parameter; markers for places without data are not hidden; desktop layout is still the 2fr / 1fr grid.
- 17.9 Living fog bound to the PHAC level: not complete. The legend sentence "Fog shows PHAC's activity level. It is not your risk." is absent from `src/`; the existing drift and Property 4 tests pass, but the transform/opacity-only and CSS-variable rework and its tests were not done.
- 17.11 Mask-lift reveal and lantern-and-fog skeleton: not implemented. No `MaskReveal.tsx` or `LanternSkeleton.tsx`.
- 17.13 Done-means verification is pending in 18.5 (full build, Playwright, Lighthouse after numbers).
