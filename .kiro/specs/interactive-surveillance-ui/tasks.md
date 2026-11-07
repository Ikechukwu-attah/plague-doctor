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

- [~] 4. Checkpoint - Ensure all tests pass
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

- [~] 13. Checkpoint - Ensure all tests pass
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
    { "id": 13, "tasks": ["14.5"] }
  ]
}
```
