# Implementation Plan: Interactive Surveillance UI

## Overview

Implementation language: TypeScript (strict), as used by the design. Order: pre-existing data/engine fixes and the history route first, then tooling and pure foundations (clock, copy, API client, URL state), the design system, geometry, the five routes (each as pure view models with property tests, then thin components, then the page), cross-cutting states, Playwright, and finally the verification gates.

All tests reference `UI-` requirement IDs and design property numbers in their names. Fixtures are real PHAC bytes from `fixtures/` (synthetic generators are labelled `synthetic`). Tests live under `tests/ui/`, `tests/api/`, `tests/geo/`, `tests/ingest/` and `e2e/`. Per the repo testing rule, tests ship with their change, so test sub-tasks are not marked optional. Do not run dev servers; use `vitest run`, `tsc`, `npm run build` and `npx playwright test` in the foreground.

## Tasks

- [x] 1. Pre-existing fixes and the history route (P1, P2, D1)
  - [x] 1.1 Make the normalized data directory injectable
    - In `src/server/ingest/snapshot-store.ts` replace the hardcoded `data/normalized` index path (`getIndexPath`, `ensureDirs`, `saveIndex`) with a `getNormalizedDir()` that reads env `NORMALIZED_DIR`, defaulting to `data/normalized`, mirroring `SNAPSHOT_DIR`
    - Use the same helper in `scripts/ingest.ts` (`NORMALIZED_DIR`, `HISTORY_DIR`) and `src/server/normalized-data.ts` (read side)
    - Index is written whenever the store writes, using the injectable dir (drop the `!process.env.SNAPSHOT_DIR` special case only if tests are isolated by 1.2; otherwise keep it)
    - _Requirements: 18.3_
  - [x] 1.2 Isolate ingestion tests and prove they never touch `data/normalized/`
    - Set `NORMALIZED_DIR` to a temp dir in `tests/ingest/snapshot-store.test.ts`, `tests/properties/ingestion.property.test.ts` and any other ingestion test that writes
    - Add `tests/ingest/normalized-isolation.test.ts`: hash/list `data/normalized/` (index.json mtime and content, file list) before and after running the ingestion store tests' operations with temp dirs; assert unchanged
    - Test name tags: `UI-18.3 UI-18.4`
    - _Requirements: 18.3, 18.4, 17.9_
  - [x] 1.3 Fix `rowCount: 0` and clean the real index
    - In `scripts/ingest.ts` set `rowCount` from the parse result (`parseTrend`/`parseAggregate`) before the snapshot is stored, so real index entries and `.meta.json` carry the true count
    - Back up nothing destructive: write a clean index by deleting `data/normalized/index.json` entries whose `sourceUrl` host is `example.com` (remove the file, then re-run `npm run ingest` in the foreground so the index is rebuilt from real PHAC snapshots); confirm `data/snapshots/` real CSVs are untouched
    - Add `tests/ingest/index-clean.test.ts` reading the real `data/normalized/index.json`: no entry with `example.com`, every `valid` entry has `rowCount > 0`
    - _Requirements: 18.5_
  - [x] 1.4 Fix past-card EpiYear matching in `buildCard` (P2)
    - In `src/evidence/card.ts` `buildHistoricalContext`: take `epiYear` from `dateToEpiWeek(input.eventDate)`; for `past` (`includeMeasured`) select `wAvg`/`weekStart` from the `MeasuredWeek` where `epiYear` AND `epiWeek` match; keep the `epiWeek`-only first match only for `histMin`/`histMax` (band)
    - If the year's row is absent, `wAvg: null`, `weekStart: undefined` (gap) while the band still comes from the epiWeek match; never borrow another year's `wAvg`
    - Add `tests/evidence/card-past-epiyear.test.ts` with real history (`data/normalized/history/toronto-fluA.json`): for the same EpiWeek in two different years, assert the past card returns each year's own `wAvg`, and that `histMin`/`histMax` are constant per EpiWeek across years
    - Keep all 116 existing tests green
    - Record the bug in the usage log later (task 14.4)
    - _Requirements: 18.6, 18.7, 17.9_
  - [x] 1.5 Add `GET /api/history` (D1)
    - Create `src/app/api/history/route.ts`: Zod query (`locationId` min 1 required, `pathogen` via `PathogenSchema` required, `from`/`to` optional `YYYY-MM-DD`); 400 invalid, 404 when `resolveLocation(locationId, readTrendLatest())` is null, 200 `[]` for a known location without a history file
    - Envelope `{ snapshotId, sampleWeek, sourceUrl: AGGREGATE_SOURCE_URL, data: MeasuredWeek[] }` sorted ascending; `from`/`to` filter inclusive
    - Add `tests/api/history.test.ts` (400, 404, 200 `[]` for Ottawa, sorted, from/to filter, `locationId`/`pathogen` match on every row) using real normalized history
    - _Requirements: 18.1, 6.1, 16.2_

- [ ] 2. Tooling and pure foundations
  - [x] 2.1 Configure test tooling and dependencies
    - `vitest.config.ts`: `include: ["tests/**/*.test.{ts,tsx}"]`, `exclude: ["e2e/**","node_modules/**"]`, `esbuild: { jsx: "automatic" }`
    - Add exact-pinned devDependencies `@playwright/test`, `@axe-core/playwright`, `d3-geo`, `mapshaper`, plus type packages needed (e.g. `@types/d3-geo`); scripts `geo:build` (`tsx scripts/build-geometry.ts`) and `test:e2e` (`playwright test`)
    - Add `tests/ui/helpers.ts` (`textOf(html)`, fixture loaders that parse `fixtures/trend-oct-2026.real.csv` and `aggregate-oct-2026.real.csv` through the production parsers, fast-check arbitraries)
    - _Requirements: 17.1, 17.10_
  - [x] 2.2 Implement the injectable clock
    - `src/lib/clock.ts`: `Clock`, `systemClock` (honours `window.__PD_TEST_NOW__` only when `NEXT_PUBLIC_PD_TEST_CLOCK === "1"`), `ClockProvider`, `useClock`, `useToday`
    - `tests/ui/clock-scan.test.ts`: no `new Date(` or `Date.now(` in `src/app`, `src/components`, `src/lib` outside `clock.ts`
    - _Requirements: 14.7, 14.8_
  - [x] 2.3 Implement fixed UI copy templates
    - `src/ui-copy/{levels,unknown-reasons,freshness,coverage,timing,card,methods,guide,planner-options,states,index}.ts` as functions with typed slots; `weekOf(date)` is the only producer of "week of {date}"; checklist only from `src/evidence/copy/checklist.ts`; no emoji; no "sampled on"
    - Include the C10 `notDetectedNote()` wording and the planner `VENUES`, `KINDS`, `ATTENDEE_CATEGORIES` lists
    - `tests/ui/ui-copy.test.ts`: **Property 18** (wording guard, required slots, banned words) with real fixture location names; emoji scan of `src/ui-copy/**` and `src/components/**`; static scan that `src/components/**` contains no health sentence literals
    - **Property 18: Every user-facing template passes the wording guard and carries its required slots**
    - **Validates: Requirements 1.10, 9.12, 14.1, 14.2, 14.3, 14.4, 14.5**
    - _Requirements: 1.10, 1.12, 9.12, 14.1, 14.3, 14.6_
  - [x] 2.4 Implement the API layer and resource logic
    - `src/lib/api/{schemas,urls,errors,client}.ts`: Zod schemas reusing `src/evidence/schemas.ts`, `buildApiUrl`/`parseApiUrl` accepting only `locationId`, `pathogen`, `from`, `to`, `search`; `ApiError`; GET-only client with injectable `fetch`; lenient snapshot-list parsing
    - `src/lib/hooks/use-resource.ts` (pure reducer core + hook, in-memory cache with in-flight de-duplication and `lastGood`), `use-media-query.ts`, `use-hydrated.ts`; `ApiProvider`
    - `tests/ui/use-resource.test.ts`: **Property 22**; example test that every `ApiError` message names its resource and offers retry
    - **Property 22: Resource state never shows data for a different key and always names the failed resource**
    - **Validates: Requirements 2.10, 12.2, 12.4**
    - _Requirements: 2.5, 2.10, 12.2, 12.4, 15.2_
  - [x] 2.5 Implement URL state and virus chip navigation
    - `src/lib/url-state.ts`: `LandingUrlSchema`, `CardUrlSchema` (strict), `SavedCardUrlSchema`, `parse*`/`serialize*`, `buildCardUrl` (no attendee parameter), `isRealDate`, `isKnownSettingId`; `nextVirus(current, key)` in `src/lib/view/chips.ts`
    - `tests/ui/url-state.test.ts`: **Property 7** (round trips; extra keys rejected; only public params); `tests/ui/chips.test.ts`: **Property 20**
    - **Property 7: URL builders round-trip and admit only public parameters**
    - **Validates: Requirements 4.3, 8.3, 8.9, 15.2**
    - **Property 20: Virus chip navigation keeps exactly one of four selected**
    - **Validates: Requirements 2.2, 2.3**
    - _Requirements: 2.2, 2.3, 4.3, 8.9, 15.1, 15.2_

- [x] 3. Design system
  - [x] 3.1 Tokens, fonts and application shell
    - `src/app/globals.css` with every §5A colour token, type scale 12/14/16/20/28/40, 4-px spacing, radii 6/12/20 and `--radius-pill`, 3 px lantern focus ring, `prefers-reduced-motion` rules
    - `src/app/layout.tsx`: `next/font/local` (Cormorant Garamond, Inter, JetBrains Mono, OFL files and licences under `src/app/fonts/`; if font files cannot be obtained, use `next/font/google` and flag it), `<html lang="en-CA">`, skip link, header/nav ("Map / Plan a gathering / Behind the mask"), `main#content`, footer, `LiveRegionProvider`, `ClockProvider`, `ApiProvider`; `src/components/shell/*`
    - `tests/ui/css-rules.test.ts` (tokens present with hex values, reduced-motion block, 12–20 s drift, 600 ms ease) and `tests/ui/contrast.test.ts` (4.5:1 text, 3:1 graphics; C20 expected-pass set)
    - _Requirements: 1.1, 1.2, 1.3, 1.11, 3.12, 3.13, 13.5, 13.6, 13.9_
  - [x] 3.2 Level, trend, freshness and three-clocks view models
    - `src/lib/view/{level,trend,freshness,three-clocks}.ts` as specified (`levelBadgeModel`, `trendGlyphModel`, `lanternModel` taking only the label, `freshnessFor` via `classifyFreshness`, `buildThreeClocks` matching `trendSnapshotId` + `TREND_SOURCE_URL` + `valid`)
    - `tests/ui/level-badge.test.tsx` **Properties 1, 2**; `tests/ui/trend-lantern.test.tsx` **Property 3**; `tests/ui/three-clocks.test.ts` **Property 19** (including equality with `buildCard(...).freshnessLabel` on real fixtures)
    - **Property 1: Level and trend are rendered verbatim**
    - **Validates: Requirements 1.4, 1.6, 5.2, 5.3**
    - **Property 2: Unknown is never relabelled as a level**
    - **Validates: Requirements 1.5, 12.6, 17.2**
    - **Property 3: Lantern depends only on the freshness label**
    - **Validates: Requirements 1.7, 1.8, 17.3**
    - **Property 19: Freshness, age and the three clocks ignore ingest time and junk snapshots**
    - **Validates: Requirements 1.9, 14.7, 14.8**
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 12.6, 17.2, 17.3_
  - [x] 3.3 Design-system components
    - `src/components/design-system/`: `LevelBadge` (hatched "No data" for unknown), `TrendGlyph`, `FreshnessLantern` (props: label only), `ThreeClocks` ("week of {date}", PHAC file updated, "Our last successful ingest"), `GuideQuote`, `Notice`, `Skeleton`, `Chip`, `Button`, `VisuallyHidden`, `LiveRegion`
    - Component tests with `renderToStaticMarkup` for every unknown reason, every freshness label, and `ThreeClocks` with missing values ("unavailable")
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.9, 1.10, 1.12, 12.5, 13.3, 17.1_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Map geometry (D2)
  - [x] 5.1 Build geometry and city points
    - `scripts/build-geometry.ts` (dev-only d3-geo/mapshaper): Natural Earth admin-1 → `src/data/geo/canada-provinces.geojson` (≤ 80 KB) and `canada-provinces.projected.json` (≤ 120 KB); `city-points.json` from Natural Earth populated places plus cited overrides (each override has `citation`); locations without a verified point are not given coordinates
    - `src/data/geo/SOURCE.md`: sources, download date, public-domain statement, regeneration command, list of unmatched locations (no marker)
    - Run `npm run geo:build` in the foreground; if Natural Earth cannot be downloaded, stop and report rather than inventing data
    - _Requirements: 3.1, 3.2, 3.3, 18.2_
  - [x] 5.2 Geometry tests
    - `tests/geo/geometry.test.ts`: Zod-parse both JSON files, size budgets, `SOURCE.md` names Natural Earth and public domain, every point inside the viewBox, every override has a citation, no point for unmatched locations
    - _Requirements: 3.1, 3.2, 18.2_

- [x] 6. Landing page
  - [x] 6.1 Landing view models: rows, fog, discontinued filter
    - `src/lib/view/{landing-rows,fog}.ts` (`buildLandingRows`, `fogSpec` per the density table; stopped rows per C23; site rows folded under their city; Gazetteer-only cities as "No monitoring site"); load points from `city-points.json`
    - `tests/ui/fog.test.ts` **Property 4**; `tests/ui/landing-rows.test.ts` **Properties 5, 6** (real trend rows plus `synthetic` Gazetteer-only entries)
    - **Property 4: Fog is a monotone function of activityIndex alone, and unknown is hatched**
    - **Validates: Requirements 3.4, 3.5, 3.7, 17.4**
    - **Property 5: Landing rows only carry their own location's values**
    - **Validates: Requirements 2.4, 3.3, 3.6, 4.1, 4.4**
    - **Property 6: The discontinued toggle is a pure, data-derived filter**
    - **Validates: Requirements 3.8, 3.9, 3.10**
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.9, 3.10, 4.1, 4.4_
  - [x] 6.2 Landing components
    - `src/components/landing/`: `VirusChips`, `CanadaMap`, `FogLayer` (CSS drift 12–20 s, 600 ms ease, static under reduced motion), `MapMarker` (accessible name, shape + glyph), `CityList`/`CityRow` (search via `/api/locations?search=`, "No matching locations", ≥ 56 px rows), `Legend` (all five variants), `StaleBanner`, `FreshnessFooter`, `DetailSurface` (400 px drawer ≥ 1024, bottom sheet 640–1023, navigation to `/city/{id}` below 640; Escape and focus return)
    - Skip-map link and text alternative for the map; "Show map" toggle below 640 px; "show discontinued sites" toggle off by default
    - Markup tests for markers, legend, empty and stale states
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 3.1, 3.6, 3.8, 3.11, 3.12, 3.13, 4.1, 4.2, 4.5, 4.6, 4.7, 4.8, 5.9, 13.2, 13.7_
  - [x] 6.3 Landing route
    - `src/app/page.tsx` (server shell: `h1` "What's in the water?", limitation line from `ui-copy`, `<Suspense>`) and `LandingView` client island: parallel requests to `/api/locations`, `/api/observations`, `/api/data-status`, `/api/snapshots`; URL state `?virus&city&view&discontinued`; one-render virus switch; loading/empty/error/stale states
    - _Requirements: 2.1, 2.4, 2.5, 2.7, 2.8, 2.9, 2.10, 2.11, 12.1_

- [x] 7. City page, timeline and provenance
  - [x] 7.1 City, timeline and provenance view models
    - `src/lib/view/{city-view,timeline,provenance}.ts`: `buildCityView` via `buildCard` with `eventDate = today`; `buildTimeline` (runs, gaps, band, markers with fixed-colour diamond per C8, summary, rows, no future points); `provenanceFor`
    - `tests/ui/city-view.test.ts` **Properties 10, 11**; `tests/ui/timeline.test.ts` **Properties 8, 9** (gap and shuffle generators from real aggregate rows, labelled `synthetic`)
    - **Property 8: Timeline plots only measured weeks, keeps gaps and never goes past the latest week**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6, 17.5**
    - **Property 9: Timeline text is complete, dated and never converts concentration**
    - **Validates: Requirements 6.5, 6.7, 6.8**
    - **Property 10: Coverage views never substitute another location's values**
    - **Validates: Requirements 5.5, 5.6, 5.7, 5.8, 9.7**
    - **Property 11: Provenance is complete and attributes classifications to PHAC**
    - **Validates: Requirements 7.1, 7.2, 7.4**
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.12, 5.13, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.1, 7.2_
  - [x] 7.2 City components and routes
    - `src/components/city/`: `CityDetail` (page/drawer/sheet variants), `VirusRow` (headline badge, separately labelled signal level, unknown reason words, "History only" when outdated, amber "Delayed" caution), `CoverageNotice` + regional toggle, `TimelineChart` (SVG, keyboard-focusable points, tooltip, data-table disclosure, 52-week default window via `/api/history?from=` and "Show all history"), `TimelineSummary`, `SitesList`, `ProvenanceDialog` (native `<dialog>`, Escape, focus return, mono IDs) and `ProvenanceTrigger` on every statement row
    - `src/app/city/[locationId]/page.tsx` (awaits `params`), not-found state, skeletons, per-section error with retry (timeline failure leaves other sections visible); wire `CityDetail` into the landing `DetailSurface`
    - Markup tests for loading, 404, outdated, delayed, no_city_site with and without aggregate
    - _Requirements: 5.1, 5.5, 5.9, 5.10, 5.11, 5.12, 5.13, 6.9, 6.10, 6.11, 7.1, 7.3, 7.4, 7.5, 12.1_

- [x] 8. Planner
  - [x] 8.1 Planner view model and attendee memory
    - `src/lib/view/planner.ts` (`plannerReducer`, `missingSteps`, `explainTiming` using `classifyTiming`/`calendarDayDiff`, `buildCardUrl`), `src/lib/attendees-memory.ts` (module singleton, `useSyncExternalStore`, no storage/cookie/fetch imports)
    - `tests/ui/planner.test.ts` **Properties 12, 21**; static scan test in `tests/ui/privacy.test.ts` that `attendees-memory.ts` imports none of `localStorage`, `sessionStorage`, `document.cookie`, `fetch`
    - **Property 12: The timing explanation matches the engine's timing rule**
    - **Validates: Requirements 8.4, 8.5**
    - **Property 21: The planner reducer only confirms complete, valid plans**
    - **Validates: Requirements 8.1, 8.11**
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.7, 8.11, 15.1_
  - [x] 8.2 Planner components and route
    - `src/components/planner/`: `PlannerStepper` (ordered list, Where/When/Setting/Who/Confirm), `WhereStep` (skeleton, error with retry keeping state, PHAC locations and Gazetteer cities, no-coverage explanation with labelled provincial aggregate and a path to the checklist), `WhenStep` + `TimingExplainer`, `SettingStep` (two fixed lists, no free text), `WhoStep` (optional, "Skip", "These choices stay on this device and are never shared"), `ConfirmStep` (disabled and naming the missing step)
    - `src/app/plan/page.tsx`; Confirm navigates to `/card?loc&date&setting` only; controls ≥ 44 px; keyboard complete
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14, 13.3_

- [x] 9. Omen Card, saved events and diff
  - [x] 9.1 Storage, card view and diff view models
    - `src/lib/storage/{storage-port,saved-event-schema,saved-events}.ts` (strict Zod schemas, `NearStatementSchema`/`HistoricalContextSchema`, `StoragePort`, `SavedEventsApi`: list/save/remove/removeAll/toEventCard; attendees stored only when `keepAttendees`)
    - `src/lib/view/{card-view,diff-view}.ts` (`buildCardView` with near/too_early/past variants, `buildDiffView`)
    - `tests/ui/card-view.test.ts` **Property 13**; `tests/ui/privacy.test.ts` **Property 14** (recording `fetch` stub over a full card load); `tests/ui/saved-events.test.ts` **Properties 15, 16**; `tests/ui/diff-view.test.ts` **Property 17**
    - **Property 13: Card views contain claims only appropriate to their timing state**
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 9.16**
    - **Property 14: Attendee categories never reach any output or request**
    - **Validates: Requirements 8.7, 9.11, 10.3, 15.1, 15.4**
    - **Property 15: Saved-event records round-trip and corrupt storage never throws**
    - **Validates: Requirements 10.2, 10.3, 10.12**
    - **Property 16: The saved-event store behaves like a list model and writes only on save**
    - **Validates: Requirements 10.1, 10.4, 10.5, 10.11, 15.5**
    - **Property 17: Diff presentation never presents a revision as a measured change**
    - **Validates: Requirements 10.6, 10.7, 10.8, 10.9, 10.10**
    - Add an example test that a past card built from real history shows that year's `wAvg` in `buildCardView` (P2 end to end)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.11, 9.16, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12, 15.1, 15.4, 15.5, 18.6_
  - [x] 9.2 Card components and route
    - `src/components/card/`: `OmenCard` (parchment, near/too_early/past, "community wastewater, not your chance of getting sick" always, attendee chips on screen only with the in-memory-only note), `VirusStatementRow`, `HistoricalStatementRow`, `ChecklistBlock` (`PREVENTION_CHECKLIST` only), `ShareTextPanel` (`<pre>` of `generateShareText(card)`, clipboard copy of the same string, `<textarea readOnly>` fallback, confirmation via live region), `SavedEventsPanel` (explicit "Save to this device", separate unchecked "Also keep who is attending on this device", per-event delete, "Delete all saved events", failure and unreadable messages), `ChangeDiff`
    - `src/app/card/page.tsx`: parse `?loc&date&setting` or `?saved`, fetch status (and history for `too_early`/`past`), run `buildCard` client-side with `useToday`, baseline-only card when the API is down, "No recent data" with the checklist when nothing exists; provenance triggers on every row
    - Markup tests for each state: loading shimmer, near, too_early, past, no_city_site, baseline-only, no data
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.13, 9.14, 9.15, 9.16, 10.1, 10.6, 10.9, 10.10, 12.1_

- [x] 10. Methods page
  - [x] 10.1 Behind the Mask
    - `src/lib/view/coverage-facts.ts` (`buildCoverageFacts`, counts only, derived from API data) with a test that no city name is hardcoded; `src/components/methods/{SourceList,Definitions,LimitsList,CoverageFacts}.tsx`; `src/app/methods/page.tsx` with static prose from `ui-copy/methods.ts`, `ThreeClocks`, schema version, snapshot ID (from the matched snapshot), ingestion-failure block with last valid sample week, clocks skeleton
    - Markup tests for NA1/NA2 definitions, 50 % / 75 % statement, non-endorsement statement, freshness convention labelled as ours
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11_

- [x] 11. Cross-cutting states, headers and wiring
  - [x] 11.1 Route error boundaries and screen-state matrix
    - `src/app/error.tsx`, `src/app/not-found.tsx` and per-route `loading.tsx` where useful; ensure one `h1` per route, landmarks, and `aria-live` announcements for state changes
    - `tests/ui/screen-states.test.tsx`: loading, empty, error/stale and success for Landing, City, Planner, Card and Methods; loading never shows values from a previous location or virus
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 13.6, 17.1_
  - [x] 11.2 Security headers and bundle hygiene
    - `next.config.ts`: production `Content-Security-Policy` (`default-src 'self'`, `connect-src 'self'`), `Referrer-Policy: no-referrer`; verify no analytics or third-party scripts and no secrets referenced from client code (static scan test in `tests/ui/privacy.test.ts`)
    - _Requirements: 15.3, 16.4, 16.5_

- [x] 12. End-to-end tests
  - [x] 12.1 Playwright configuration
    - `playwright.config.ts`: `webServer` runs `npm run build && npm run start -- -p 3100` with `NEXT_PUBLIC_PD_TEST_CLOCK=1`; projects desktop 1440×900 and mobile 390×844 (Chromium) plus a reduced-motion variant; `e2e/helpers.ts` sets `window.__PD_TEST_NOW__ = "2026-11-02T15:00:00-05:00"` via `addInitScript`
    - Note in the README of `e2e/` that `npx playwright install chromium` is needed once
    - _Requirements: 17.6, 14.8_
  - [x] 12.2 Write the Playwright specs
    - `smoke.spec.ts` (landing → Toronto → plan → card; clipboard text equals shown share text), `ottawa.spec.ts` (provincial-aggregate notice, no other city's values), `a11y.spec.ts` (axe on `/`, `/city/toronto`, `/plan`, `/card?…`, `/methods`; fail on serious/critical), `keyboard-and-viewport.spec.ts` (focus return, Escape, 44 px targets, 390 px no horizontal scroll, drawer vs sheet), `privacy-network.spec.ts` (only same-origin GETs, no category strings), `wording-routes.spec.ts` (route text through `checkWording`), `reduced-motion.spec.ts`
    - _Requirements: 17.6, 17.7, 17.8, 4.7, 4.8, 5.9, 7.5, 8.12, 9.1, 9.8, 13.1, 13.2, 13.3, 13.4, 13.5, 14.5, 15.2, 15.3_
  - [x] 12.3 Run the Playwright suite
    - Run `npx playwright install chromium` then `npx playwright test` in the foreground; fix failures; if the browser cannot be installed in this environment, report that clearly and continue
    - _Requirements: 17.6, 17.7, 17.8_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Final verification and documentation
  - [x] 14.1 Type check
    - Run `npx tsc --noEmit`; fix all errors (no `any` in `src/evidence` or `src/server`)
    - _Requirements: 17.10_
  - [x] 14.2 Unit and property tests
    - Run `npx vitest run`; all 116 existing tests plus the new tests must pass
    - _Requirements: 17.9, 17.10_
  - [x] 14.3 Production build
    - Run `npm run build`; read "First Load JS" for `/` and confirm ≤ 200 KB gzip (if over, replace client-side Zod envelope schemas with hand-written guards first)
    - _Requirements: 16.1, 17.10_
  - [x] 14.4 Update `docs/KIRO_USAGE.md`
    - Record this spec's usage (requirements-first workflow, decisions D1/D2, P1/P2 fixes) and every real bug a property test or example test caught during implementation (including the P2 EpiYear bug and any others found), with the test name and requirement ID; note manual items not automated (Lighthouse LCP, screen-reader pass, comp fidelity)
    - _Requirements: 17.11_
  - [x] 14.5 Final summary
    - Report in the final reply: what was built, gate results (tsc, vitest, build, Playwright), First Load JS size, bugs found and fixed, and what was not verified (visual fidelity, LCP, assistive technology, PHAC reuse-licence wording)
    - _Requirements: 17.10, 17.11_

- [x] 15. Visual fidelity and performance fixes (post-verification)
  - Constraints for the whole group: do not touch `src/evidence/**` or the wording guard (`checkWording`); share text output stays unchanged; do not touch licence text; keep all existing tests green (baseline: vitest 45 files / 398 tests, Playwright 57 passed / 18 skipped); use file-write tools only for edits (no sed/awk/echo redirection); no hardcoded cities, sites or coverage; no invented data; no new health claims (honesty copy is kept as is).
  - Breakpoint decision (supersedes the 640–1023 sheet range in 6.2): drawer ≥ 1024 px, bottom sheet 768–1023 px, navigate to `/city/{id}` below 768 px. The "Show map" collapse below 640 px (UI-4.8) is unchanged. `requirements.md` UI-5.9 and `design.md` are already updated to match.
  - [x] 15.1 Provenance trigger visibility and contrast
    - In `src/components/city/ProvenanceTrigger` render a visible "i" glyph (text or SVG, not colour alone) with an accessible name, on both the parchment card (`Card.module.css`) and dark surfaces (`City.module.css`); glyph and ring ≥ 4.5:1 against their own background, 44 px hit target preserved, lantern focus ring kept
    - Use CSS tokens so the parchment and dark variants are chosen by surface, not by duplicated components
    - Add `tests/ui/provenance-trigger.test.tsx`: markup test (glyph present, `aria-label`, `button` type, both surface variants) and a contrast test computing ratios from the token hex values (≥ 4.5:1 on parchment and on dark)
    - Extend `e2e/a11y.spec.ts` with an axe check scoped to the card (`/card?…`) and city (`/city/toronto`) triggers, failing on serious/critical
    - _Requirements: UI-7.1, UI-7.3, UI-1.2, UI-13.1, UI-13.5, UI-13.6_
  - [x] 15.2 City detail surface: drawer, sheet and single close control
    - In `src/components/landing/DetailSurface` and `src/components/city/CityDetail`: ≥ 1024 px fixed 400 px right-hand drawer; 768–1023 px bottom sheet; below 768 px navigate to `/city/{id}` (update the `useMediaQuery` thresholds and the row/marker activation logic)
    - Position `fixed`/`sticky` so the surface is never in document flow (no layout shift of the map or list when opened); scroll inside the surface; Escape closes, focus moves to the heading on open and returns to the opener on close
    - Exactly one close control: remove the duplicate X/Close button so only a single labelled close button remains in drawer and sheet variants (the page variant has none)
    - Add `tests/ui/detail-surface.test.tsx` (variant chosen per width including 767/768/1023/1024, one close control in markup, fixed/sticky class) and Playwright cases in `e2e/keyboard-and-viewport.spec.ts` for 1440, 900 and 390 px (surface position fixed, single `Close` button, focus return, no horizontal scroll)
    - _Requirements: UI-5.9, UI-4.8, UI-5.10, UI-13.2, UI-13.3, UI-13.4_
  - [x] 15.3 Shared PageContainer
    - Create `src/components/shell/PageContainer.tsx` (+ module CSS): content centred, max width about 1100 px, 16 px gutter on mobile, optional `variant="city"` for the city page; renders a plain wrapper (no landmark change; `main#content` stays in the layout)
    - Replace ad hoc wrapper layout in `src/app/plan/page.tsx`, `src/app/card/page.tsx`, `src/app/methods/page.tsx` and `src/app/city/[locationId]/page.tsx`; remove the now-unused per-page container CSS
    - Add `tests/ui/page-container.test.tsx` (class/props, variants, each route's markup uses it) and keep Playwright no-horizontal-scroll checks at 390 px green
    - _Requirements: UI-1.1, UI-1.3, UI-13.2, UI-8.12, UI-9.1, UI-11.1_
  - [x] 15.4 Landing map fits the viewport; labels and fog
    - In `LandingView`/`CanadaMap`/`CityList` and their CSS: map height bounded to the viewport (e.g. `max-height: calc(100dvh - header - controls)` with the SVG `preserveAspectRatio` kept), no 850 px-tall map; the city list scrolls inside its own column (`overflow-y: auto`, bounded height) and the page itself does not grow with the list
    - Read `design/Main.dc.html` to determine which markers the comp labels and how many; implement a data-derived label rule, not a hardcoded name list: always label the selected city, plus the top N locations (N taken from the comp) ranked by population from `src/data/geo/city-points.json` (build-time attribute), with a collision check so labels never overlap, and ties/unknowns resolved by `locationId` order; labels are text next to the marker and never replace the accessible name
    - Verify the fog glows render visibly: check the `FogLayer` blur/opacity/z-order and that glows sit behind markers and are not clipped by the bounded container; record the screenshot check at 1440 and 390 px
    - Add `tests/ui/landing-map.test.tsx` (label set = selected + top N, derived from supplied points, stable under shuffle; no label for cities without a point; fog layer present per level), and a Playwright check for map height ≤ viewport and an internally scrolling list at 1440×900
    - _Requirements: UI-3.1, UI-3.4, UI-3.5, UI-3.6, UI-3.11, UI-3.12, UI-4.1, UI-4.5, UI-13.2, UI-13.7_
  - [x] 15.5 Planner stepper with completed-step summaries
    - Per `design/Planner.dc.html`, show a check mark and a one-line summary on each completed step in `PlannerStepper` (place; date plus days away via `explainTiming`; setting); summaries come from `ui-copy` templates and the planner view model; the Who step shows nothing that reveals attendee categories
    - Keep the stepper an ordered list with `aria-current` on the active step; the check mark is a glyph with a text alternative, not colour alone
    - Add `tests/ui/planner-stepper.test.tsx` (check and summary appear only for completed steps; summary text for place/date/setting; no attendee content; wording guard on summaries) and extend the planner Playwright case
    - _Requirements: UI-8.1, UI-8.3, UI-8.4, UI-8.5, UI-8.7, UI-13.3, UI-14.5_
  - [x] 15.6 Bird icon on the Omen Card and favicon
    - Extract the bird glyph from the logo in the `design/*.dc.html` comps into `src/components/design-system/BirdIcon.tsx` (inline SVG, `aria-hidden`, `currentColor`) and show it in the `OmenCard` header
    - Add `src/app/icon.svg` from the same glyph so Next serves the favicon, and ensure no request for `/favicon.ico` returns 404 (add `src/app/favicon.ico` only if the Next icon route does not satisfy the request)
    - Add `tests/ui/bird-icon.test.tsx` (card header markup contains the icon; `src/app/icon.svg` exists, is valid SVG and uses the same path data as `BirdIcon`) and a Playwright check that `/icon.svg` and the favicon request return 200 with no 404 on `/`
    - _Requirements: UI-1.1, UI-1.2, UI-9.1, UI-13.1_
  - [x] 15.7 Landing LCP and performance
    - Diagnose first, before changing code: run a production build, a Lighthouse mobile run on `/` with a saved trace, and a bundle analysis; identify the real cause of the 4.9 s render delay on the limitation `<p>` (render-blocking CSS, font loading, hydration and TBT from `LandingView`, long tasks); record the findings and the before numbers in `docs/KIRO_USAGE.md`
    - Make the `h1` and limitation line fully server-rendered with no client dependency (no client wrapper or Suspense fallback around them), keeping the limitation text unchanged
    - Defer non-critical client work until after first paint: code-split `CanadaMap` and `DetailSurface` with `next/dynamic`, render fog and the city list after first paint (e.g. `useEffect`/idle callback or `startTransition`), avoid blocking CSS and font swaps that delay the paragraph (`font-display: swap`, preload only the font used by the LCP element)
    - Targets on `/` (Lighthouse mobile): performance ≥ 80, LCP < 2.5 s; First Load JS for `/` must not exceed the 163 kB baseline; no honesty copy removed
    - Add `tests/ui/landing-ssr.test.tsx` (server markup of `/` contains the `h1` and limitation line without client-only code) and a Playwright check that the limitation line is visible before hydration (JavaScript disabled)
    - _Requirements: UI-16.1, UI-16.2, UI-16.3, UI-2.1, UI-12.1, UI-1.12_
    - Findings (details and tables in `docs/KIRO_USAGE.md` § Task 15.7): observed LCP = FCP ≈ 0.2 s in the trace. The "render delay" is Lighthouse's simulated cost of everything requested before first paint: 2 render-blocking CSS files, 4 preloaded fonts, and 163 kB of route JS (map, province paths, detail surface, CityDetail, and Zod pulled into the root layout via ApiProvider). Fixed with a lazy island plus lazy map and detail, a Zod-free client facade, inlined CSS, an Inter-only preload, and a reserved-height pending state. `/` median: perf 92, LCP 2.4 s, TBT 280 ms, CLS 0.01, First Load JS 108 kB. Also fixed: map marker label-in-name (axe serious), which the networkidle timeouts had been masking (those timeouts came from server load, not polling).
  - [x] 15.8 Re-verify and report before/after
    - Run `npx tsc --noEmit`, `npx vitest run`, `npm run build` (read First Load JS), `npx playwright test` including axe, and Lighthouse (mobile) on `/`, `/plan`, `/methods` and `/city/toronto`
    - Capture screenshots at 1440 px and 390 px and compare them with `design/Main.dc.html`, `design/Planner.dc.html`, `design/OmenCard.dc.html`, `design/Mobile.dc.html` and `design/States.dc.html` (390 px for the Mobile and States comps); list remaining differences honestly
    - Report before/after: Lighthouse `/` perf 49 / a11y 100 / LCP 5.5 s / TBT 1750 ms; `/plan` 78 / LCP 3.2 s; `/methods` 89 / LCP 3.0 s; `/city/toronto` 86 / LCP 3.6 s; vitest 45 files / 398 tests; Playwright 57 passed / 18 skipped; First Load JS `/` 163 kB; add the table and any bugs found to `docs/KIRO_USAGE.md`
    - Confirm `src/evidence/**`, the wording guard, share text and licence text are unchanged (`git diff --stat` shows no changes to them)
    - _Requirements: UI-1.1, UI-3.1, UI-5.9, UI-13.1, UI-13.2, UI-13.5, UI-16.1, UI-16.2, UI-17.6, UI-17.7, UI-17.10_

- [x] 16. Follow-ups
  - Constraints for the whole group: no other work; do not touch `src/evidence/**` or the wording guard (`checkWording`); do not change any other licence or `EDUCATIONAL_STATEMENT` text.
  - [x] 16.1 Planner Who step summary follows the spec
    - The completed Who step in the stepper shows only "Specified" or "Skipped", never category names; categories appear on the Confirm step only
    - Update `stepSummaryWho` in `src/ui-copy/planner.ts`, `tests/ui/planner-stepper.test.tsx`, and any other tests or e2e specs that expect category text in the stepper
    - Add a test that no attendee category string appears in the stepper markup
    - _Requirements: UI-8.7, UI-15.1_
  - [x] 16.2 Data attribution line
    - Add the template via `src/ui-copy` (checked by the wording guard in tests) with this exact text: "Data: Wastewater monitoring dashboard: Respiratory virus activity, Public Health Agency of Canada. Reproduced from health-infobase.canada.ca/wastewater; not an official version and not affiliated with PHAC."
    - Link "health-infobase.canada.ca/wastewater" to `https://health-infobase.canada.ca/wastewater/`
    - Show it in the site footer (`src/components/shell`) and in the `/methods` Sources section
    - Add tests for presence on both, the link target, and wording-guard cleanliness; if `checkWording` rejects the exact text, report it instead of altering the guard or the text
    - _Requirements: UI-11.1, UI-11.7, UI-14.5_
  - [x] 16.3 Delete scratch files and verify
    - Delete `.lh-report.cjs` and `.lh-trace.cjs` in the repo root and any temp or scratch files such as `e2e/zz-shots.tmp.ts`
    - Run `npx tsc --noEmit` and `npx vitest run`, and report the counts
    - _Requirements: UI-17.10_

- [ ] 17. Review fixes and Costume Contest polish (Milestone 4)
  - Numbering note: `docs/MILESTONE_4_REVIEW_FIXES.md` calls this "group 16", but 16 is already taken by "Follow-ups". Mapping: tasks 17.1 to 17.12 are doc items 16.1 to 16.12 (same order: P0 bugs 17.1 to 17.5, P1 clarity 17.6 to 17.8, Costume Contest polish 17.9 to 17.12); 17.13 is the doc's "Done means".
  - Constraints for the whole group: no forecasts, risk, "safe" claims or new scores; all user-facing copy only via `src/ui-copy/**` and covered by the wording guard tests; all dates via the clock module (`src/lib/clock.ts`); `prefers-reduced-motion` respected; do not change `src/evidence/**` or the wording guard (`checkWording`); put the regional-site table in a non-evidence module (`src/server/geo` or `src/data`); do not change share text output or any licence or attribution text; keep existing vitest and Playwright baselines green; file-write tools only for edits (no sed/awk/echo redirection); no deploy; do not start dev servers.
  - [x] 17.1 Cluster map markers so hit targets never overlap (doc 16.1, P0)
    - Create `src/components/landing/map-clusters.ts` with pure `clusterMarkers(points, mapSize, hitSize = 44)` (connected components of intersecting 44 px boxes, deterministic by `locationId`) and `ClusterChooser.tsx` reusing the City_List row component; update `CanadaMap.tsx` to render clusters named "{n} places" and recompute on resize; keep 44 px targets
    - Add `e2e/map-hit.spec.ts`: at 1440 px and 390 px, for every visible marker or cluster `document.elementFromPoint` at its centre returns that same element; cluster opens the chooser and a row opens the place
    - Write property test for clustering
    - **Property 23: Marker clustering keeps every hit target unique and non-overlapping**
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.4**
    - _Requirements: UI-19.1, UI-19.2, UI-19.3, UI-19.4_
  - [x] 17.2 Omen Card created date from the local calendar (doc 16.2, P0)
    - In `CardScreen.tsx` replace the `toISOString()`-based `createdAt` with the local calendar date from the clock module (`useToday`, helper in `src/lib/clock.ts` if needed); keep `clock-scan` test green
    - Test with a fixed clock 2026-11-07T23:30-05:00 shows "Nov 7, 2026"
    - Write property test for the created date
    - **Property 24: The created date is the local calendar date for any instant**
    - **Validates: Requirements 19.5, 19.6**
    - _Requirements: UI-19.5, UI-19.6_
  - [x] 17.3 404 page inside PageContainer (doc 16.3, P0)
    - Wrap `src/app/not-found.tsx` in `PageContainer`; extend the 390 px no-overflow Playwright test to `/nope`; add a markup test that the 404 uses PageContainer
    - _Requirements: UI-19.7_
  - [x] 17.4 Regional-site resolution with citations and label (doc 16.4, P0)
    - Create the reviewed table and resolver in a non-evidence module (`src/server/geo/regional-sites.ts` or `src/data/geo/regional-sites.json` with Zod schema): `city → PHAC locationId` only where PHAC's own location name or site list covers the city (for example Vancouver to Metro Vancouver, with the Iona Island, Lions Gate, Lulu Island and Annacis Island plants), a non-empty `citation` per row, no guessing; target must exist in the current snapshot
    - Show a "Regional site" label and an "i" explaining catchment versus city boundary on the City_Page and the City_List row (`RegionalSiteBadge.tsx`, copy in `src/ui-copy/coverage.ts`); cities not in the table keep "No monitoring site" and the provincial-aggregate offer
    - Add Playwright check that Vancouver shows the regional label and Metro Vancouver values; confirm `git diff` leaves `src/evidence/**` untouched
    - Write property test for the resolver
    - **Property 25: Only reviewed table rows resolve to a regional site**
    - **Validates: Requirements 19.8, 19.9, 19.10, 19.11**
    - _Requirements: UI-19.8, UI-19.9, UI-19.10, UI-19.11_
  - [x] 17.5 Planner date min/max and validation message (doc 16.5, P0)
    - Create `src/components/planner/date-range.ts` (`plannerDateRange`, `validatePlannerDate`) using the clock in `America/Toronto`; set `min` = today and `max` = today + 365 days on the input; add the validation message to `src/ui-copy/planner.ts`; reducer treats invalid date as missing and keeps Confirm disabled
    - Unit test plus Playwright test including a six-digit year
    - Write property test for date validation
    - **Property 26: Planner date range validation matches the clock**
    - **Validates: Requirements 19.12, 19.13, 19.14**
    - _Requirements: UI-19.12, UI-19.13, UI-19.14_
  - [x] 17.6 City list sort control stored in the URL (doc 16.6, P1)
    - Create `src/components/landing/sort.ts` (`sortLocations`) and `SortControl.tsx`: "A–Z" (default) and "Highest activity first" by PHAC category rank only, unknown/no data/not monitored last, ties A–Z; add `sort` to the URL builders and public-parameter list; compute no new score
    - Write property test for sorting and a URL round-trip test; add the control labels to `ui-copy`
    - **Property 27: Sort order depends only on the PHAC category, then A–Z, stably, unknown last**
    - **Validates: Requirements 19.15, 19.16, 19.17**
    - _Requirements: UI-19.15, UI-19.16, UI-19.17_
  - [ ] 17.7 Bigger map and quieter markers (doc 16.7, P1)
    - Rebalance the desktop layout so the map uses most of the content width with a narrower list column; hide markers for locations without data or monitoring site by default; add the "Show places without data" toggle (URL parameter, copy in `ui-copy`); the list stays unchanged
    - Tests: toggle changes markers only, list rows identical; Playwright check at 1440 px for map width share and the toggle; 390 px layout unchanged in behaviour
    - _Requirements: UI-19.18, UI-19.19_
  - [x] 17.8 Status explanations and recent PHAC weeks (doc 16.8, P1)
    - Audit the City_Page "i" content against the five topics (High/Moderate/Low as PHAC categories; PHAC trend definition and window; different sample weeks; NA1/NA2 and missing-week meanings; "community signal, not personal chance"); fill gaps in `src/ui-copy/status-explanations.ts` using only existing PHAC definitions from `src/evidence/copy/**` and the methods copy (imported, not edited)
    - Add `src/components/city/recent-weeks.ts` returning the last 12 PHAC weeks with missing weeks marked and never interpolated; render it on the City_Page and in the chart's text alternative
    - Tests: topics present, wording guard clean, 12-week strip with a gap marked missing (real fixture history)
    - _Requirements: UI-19.20, UI-19.21_
  - [ ] 17.9 Living fog bound to the PHAC level (doc 16.9, P1)
    - Update `FogLayer.tsx` and its CSS: slow drift using only `transform` and `opacity`, density and opacity from CSS variables following `activityIndex`, unknown stays hatched and never the lowest density; static under `prefers-reduced-motion`; add the legend sentence "Fog shows PHAC's activity level. It is not your risk." via `ui-copy`
    - Tests: legend present, existing fog property (P4) still green, CSS rule test for reduced-motion and compositor-only properties; Playwright reduced-motion check
    - Write property test for reduced motion
    - **Property 29: Reduced motion means no animation**
    - **Validates: Requirements 19.22, 19.23, 19.24**
    - _Requirements: UI-19.22, UI-19.23, UI-19.24_
  - [x] 17.10 Omen Card restyle with wax seal and voice lines (doc 16.10, polish)
    - Restyle the card (parchment, ornate border, `WaxSeal.tsx` using `BirdIcon`, level as "arcana"); add `cardVoiceLine` with one fixed line per PHAC level in `src/ui-copy/card.ts` (for example High: "The waters carry a strong signal this week.") describing the signal, never the risk; no "safe", "danger", "you will" or percentages
    - Keep share text byte-identical: add a snapshot-style test comparing `generateShareText` output before and after; contrast test still passes for new tokens
    - Write property test for voice lines
    - **Property 28: Voice lines pass the wording guard, one per level, and never use banned words**
    - **Validates: Requirements 19.25, 19.26, 19.27**
    - _Requirements: UI-19.25, UI-19.26, UI-19.27_
  - [ ] 17.11 Mask-lift reveal and lantern-and-fog skeleton (doc 16.11, polish)
    - Add `MaskReveal.tsx` (about 600 ms, first view of `/methods`, skipped for reduced motion) and `LanternSkeleton.tsx` replacing grey bars in the loading states with the same reserved heights
    - Tests: reduced-motion CSS rule, skeleton keeps reserved heights (class/min-height assertions), screen-state matrix still green; CLS checked in 17.13
    - **Property 29: Reduced motion means no animation** (extend the CSS-rule property test to the reveal and skeleton)
    - **Validates: Requirements 19.28, 19.29**
    - _Requirements: UI-19.28, UI-19.29_
  - [x] 17.12 Social preview metadata and "Download card as image" (doc 16.12, polish)
    - Add Open Graph and Twitter metadata in the root layout and a static `src/app/opengraph-image.tsx` (bird glyph, title, "Wastewater signals, not forecasts", no live data); tests that the metadata is present on all routes and the image has no data fetch
    - Add `src/components/card/card-image.ts` and `DownloadCardImage.tsx`: SVG to canvas to PNG client-side from the same share data; no external service and no dependency over about 10 KB gzipped; lazy-load so the landing bundle does not grow. If not feasible, skip the download part, add no dependency, and report it in 17.13 and `docs/KIRO_USAGE.md`
    - Privacy test: attendee categories never appear in the image or filename
    - _Requirements: UI-19.30, UI-19.31, UI-19.32, UI-15.1_
  - [ ] 17.13 Done-means verification and report
    - Before any change, record a baseline: Lighthouse mobile median (at least 3 runs) on `/` and the vitest and Playwright counts
    - At the end run `npx tsc --noEmit`, `npx vitest run`, `npm run build` and `npx playwright test` (including the new marker-hit at desktop and 390 px and the date tests) and report counts
    - Run Lighthouse mobile median on `/` after the changes and report before/after (performance ≥ 90, LCP ≤ 2.5 s, CLS near 0, First Load JS)
    - Capture screenshots at 1440 and 390 px of: the landing page with a cluster open, the Toronto city page, the Vancouver city page, the Omen Card, and the 404 page
    - Update `docs/KIRO_USAGE.md` with what was found and fixed, any bug a test caught and the Lighthouse table; report anything not done (for example a skipped PNG download)
    - Confirm `git diff --stat` shows no changes to `src/evidence/**`, the wording guard, share text or licence text; no deploy
    - _Requirements: UI-19.4, UI-19.14, UI-19.33, UI-19.34, UI-17.10, UI-17.11_

- [x] 18. Milestone 4 follow-ups (review of M4 work)
  - Same constraints as group 17 (no forecasts or risk claims, copy via `src/ui-copy/**`, dates via the clock module, `src/evidence/**`, wording guard, share text and licence text untouched, no deploy, no dev servers).
  - [x] 18.1 Provenance dialog body renders only while open
    - Problem: the closed `<dialog>` in `ProvenanceTrigger.tsx` renders its full explanation in the DOM (about 16 repeated copies per city page) and level words appear inside a No-data card, so `tests/ui/screen-states.test.tsx` UI-12.6 fails
    - Render the body only while open; remove repeated definitions from the closed state; keep Escape closing and focus return to the trigger
    - Do not weaken the UI-12.6 test; add a test that a closed City_Page has no repeated definition text and that opening shows the body and closing unmounts it
    - Keep the e2e keyboard and a11y specs green
    - _Requirements: UI-19.35, UI-19.36, UI-19.37, UI-7.5, UI-12.6_
  - [x] 18.2 Omen Card created date uses the viewer's local calendar date
    - Add a clock-module helper (`localDateParts` in `src/lib/clock.ts`) and replace the `toTorontoIso` use in `CardScreen.tsx`; keep `clock-scan` green
    - Test: fixed clock 2026-11-07T22:30-08:00 in the Vancouver time zone shows "Nov 7, 2026"; keep the Toronto 2026-11-07T23:30-05:00 case
    - Update the property test for **Property 24: The created date is the local calendar date for any instant** (now viewer-local, any IANA zone)
    - **Validates: Requirements 19.5, 19.6**
    - _Requirements: UI-19.5, UI-19.6_
  - [x] 18.3 Open Graph and Twitter metadata, static social image and card PNG download (doc item 16.12)
    - Add Open Graph and Twitter metadata on all routes and a static `src/app/opengraph-image.tsx` (bird glyph, title, "Wastewater signals, not forecasts", no live data); tests that metadata is present on all routes and the image performs no data fetch
    - Add `card-image.ts` and `DownloadCardImage.tsx`: SVG to canvas to PNG client-side from the same share data, lazy-loaded, no external service, no dependency over about 10 KB gzipped; privacy test that attendee categories never appear in the image or filename
    - If infeasible within those limits, add nothing and report it as infeasible in 18.4
    - _Requirements: UI-19.30, UI-19.31, UI-19.32, UI-15.1_
  - [x] 18.4 Reconcile group 17 statuses and document Milestone 4
    - Audit each of 17.6 to 17.12 against the code and tests and set checkboxes honestly: mark done what is implemented and tested, leave unimplemented items unchecked, and list the unchecked items in the final report
    - Add a "Milestone 4" section to `docs/KIRO_USAGE.md`: bugs found and fixed, before/after numbers, anything skipped (including the PNG download if infeasible)
    - _Requirements: UI-19.34_
  - [x] 18.5 Final verification
    - Run `npx tsc --noEmit`, `npx vitest run`, `npm run build` and `npx playwright test`, and report counts
    - Run Lighthouse mobile on `/`, median of 3, and compare with the baseline: performance 89/91/92, LCP 2.38/2.37/2.50 s, CLS about 0.01, TBT 391/324/257 ms, First Load JS for `/` 108 kB; gate: performance 90 or above, LCP 2.5 s or below
    - Confirm `git diff --stat` shows no changes to `src/evidence/**`, the wording guard, share text or licence text; delete temporary files
    - _Requirements: UI-19.33, UI-19.34_

## Notes

- Tests are not marked optional: the repo rule requires tests with every evidence-engine or ingestion change, and the design's 22 properties are the acceptance gate.
- Each task references granular requirement IDs (`UI-N.M` = Requirement N, criterion M); property sub-bullets name the design property and the criteria it validates.
- Task 1 touches shared files (`scripts/ingest.ts`, `snapshot-store.ts`, `card.ts`); later tasks must not run ingestion again after 1.3.
- Do not hardcode cities, sites or coverage anywhere; do not invent coordinates, readings or dates.
- Execute with Start task in this file; this workflow only produced the plan.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.5", "2.2", "2.3", "2.4", "2.5"] },
    { "id": 2, "tasks": ["1.3", "3.1", "3.2", "5.1"] },
    { "id": 3, "tasks": ["3.3", "5.2", "6.1", "7.1", "8.1", "9.1"] },
    { "id": 4, "tasks": ["6.2", "7.2", "8.2", "9.2", "10.1"] },
    { "id": 5, "tasks": ["6.3", "11.1", "11.2"] },
    { "id": 6, "tasks": ["12.1"] },
    { "id": 7, "tasks": ["12.2"] },
    { "id": 8, "tasks": ["12.3"] },
    { "id": 9, "tasks": ["14.1"] },
    { "id": 10, "tasks": ["14.2"] },
    { "id": 11, "tasks": ["14.3"] },
    { "id": 12, "tasks": ["14.4"] },
    { "id": 13, "tasks": ["14.5"] },
    { "id": 14, "tasks": ["15.1", "15.3", "15.5"] },
    { "id": 15, "tasks": ["15.2", "15.6"] },
    { "id": 16, "tasks": ["15.4"] },
    { "id": 17, "tasks": ["15.7"] },
    { "id": 18, "tasks": ["15.8"] },
    { "id": 19, "tasks": ["16.1", "16.2"] },
    { "id": 20, "tasks": ["16.3"] },
    { "id": 21, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5"] },
    { "id": 22, "tasks": ["17.6", "17.8", "17.9", "17.10"] },
    { "id": 23, "tasks": ["17.7", "17.11", "17.12"] },
    { "id": 24, "tasks": ["17.13"] },
    { "id": 25, "tasks": ["18.1", "18.2", "18.3"] },
    { "id": 26, "tasks": ["18.4"] },
    { "id": 27, "tasks": ["18.5"] }
  ]
}
```
