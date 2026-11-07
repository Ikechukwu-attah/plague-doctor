# Implementation Plan: Evidence Engine

**Spec:** evidence-engine
**Prefix:** EVD

---

## Overview

Convert the evidence-engine design into incremental coding steps. Each task builds on the previous ones and ends with everything wired together. All modules are pure TypeScript in `src/evidence/` — no I/O, no network, no `new Date()`. Tests use Vitest + fast-check; real PHAC fixtures are parsed in test setup via existing ingestion parsers.

---

## Tasks

- [x] 1. New types for the evidence engine
  - [x] 1.1 Create `src/evidence/card-types.ts` with all new types from design §3
    - Add `FreshnessLabel`, `TimingState`, `CoverageResult`, `NearStatement`, `HistoricalContext`, `EventCard` (with `attendeeCategories: string[]` — local rendering only, never serialized), `DiffStatus`, `DiffEntry`, `DiffResult`, `PreventionChecklist`, `CardBuilderInput`, `CardBuilderData`
    - Import `Pathogen`, `Activity`, `Direction`, `UnknownReason`, `StatusObservation`, `MeasuredWeek`, `CoverageStatus`, `LocationEntry` from `./types` — do NOT redefine them
    - _Requirements: EVD-1, EVD-2, EVD-3, EVD-4, EVD-5, EVD-6, EVD-10_
  - [x] 1.2 Verify `npm run typecheck` exits 0

- [x] 2. Date utilities
  - [x] 2.1 Create `src/evidence/date-utils.ts`
    - Implement `toTorontoDateString(d: Date | string): string` using `Intl.DateTimeFormat` with `timeZone: "America/Toronto"`; date-only strings get noon-UTC anchoring (`${d}T12:00:00Z`) to avoid midnight straddling a different Toronto calendar day
    - Implement `calendarDayDiff(from: string, to: string): number` using noon-UTC anchored millisecond math (`Math.round(ms / 86_400_000)`)
    - Implement `dateToEpiWeek(date: string): { epiYear: number; epiWeek: number; weekStart: string }` returning the EpiWeek whose Sunday `weekStart` is on or before the given date (≤ 6 days earlier), computed in Toronto calendar time
    - No `new Date()` at call sites — all callers inject `today`
    - _Requirements: EVD-1.1, EVD-3.1_
  - [x] 2.2 Verify `npm run typecheck` exits 0

- [x] 3. Prevention checklist constant
  - [x] 3.1 Create `src/evidence/copy/checklist.ts`
    - Create `src/evidence/copy/` directory
    - Export `PREVENTION_CHECKLIST` typed as `PreventionChecklist` (imported from `../card-types`) and exported `as const`; six items verbatim: `"Get your recommended vaccines."`, `"Stay home when you're sick."`, `"Wear a well-fitting respirator or mask."`, `"Improve indoor ventilation."`, `"Clean your hands regularly."`, `"Cover your coughs and sneezes."`
    - `sourceUrl: "https://www.canada.ca/en/public-health/services/diseases/respiratory-infectious-diseases-reduce-spread-personal-protective-measures.html"`
    - `reviewedOn: "2026-10-31"`
    - _Requirements: EVD-10.1, EVD-10.2_
  - [x] 3.2 Verify `npm run typecheck` exits 0

- [x] 4. Freshness classifier
  - [x] 4.1 Create `src/evidence/freshness.ts`
    - Implement `classifyFreshness(weekStart, latestTrend, activityIndex, unknownReason, today): FreshnessLabel` — `today` is required; no `new Date()` inside
    - Decision ladder (exact order): (1) `weekStart` absent/null/not `YYYY-MM-DD` → `"no_data"`; (2) `activityIndex === "unknown"` AND `unknownReason` is `"na1_new_site"` or `"na2_not_sampling"` → `"no_data"`; (3) `latestTrend === "No Recent Data"` → `"outdated"`; (4) compute `age = calendarDayDiff(toTorontoDateString(weekStart), toTorontoDateString(today))`; (5) `age ≤ 21` → `"latest_available"` · `22–35` → `"delayed"` · `> 35` → `"outdated"`
    - _Requirements: EVD-1.1, EVD-1.2, EVD-1.3, EVD-1.4, EVD-1.5, EVD-1.6, EVD-1.6a, EVD-1.7, EVD-1.9_
  - [x]* 4.2 Write unit and property tests for the freshness classifier
    - Create `tests/evidence/freshness.test.ts`
    - Unit tests for all 5 decision-ladder branches; boundary values: age 21 → `"latest_available"`, 22 → `"delayed"`, 35 → `"delayed"`, 36 → `"outdated"`; DST spring-forward boundary test
    - Property P1 (fast-check, min 100 runs) over `fc.constantFrom(...realObservations)` parsed from `fixtures/trend-oct-2026.real.csv`: changing only a fake `fetchedAt` field while keeping `weekStart` and `today` constant never changes the freshness label
    - Test name for P1: `"EVD-1 P1: freshness never depends on ingest time — oct-2026 fixture"`
    - _Requirements: EVD-1.8_
  - [x] 4.3 Verify `npm run typecheck && npm run test` exit 0

- [x] 5. Coverage resolver
  - [x] 5.1 Create `src/evidence/coverage.ts`
    - Implement `resolveCoverage(locationId: string, observations: StatusObservation[], isGazetteerCity: boolean, pruid?: string): CoverageResult` — `isGazetteerCity` injected by caller; module does no I/O; never throws
    - Algorithm: filter by `locationId`; any `grouping = "city"` → `city_site`; only `grouping = "site"` → `site_only`; no obs + `isGazetteerCity = true` → scan for province row by `pruid`, return `no_city_site` with `regional` or `unknownReason: "aggregate_below_coverage"`; no obs + `isGazetteerCity = false` → `unknown` (API layer returns 404); unexpected state → `unknown`
    - _Requirements: EVD-2.1, EVD-2.2, EVD-2.3, EVD-2.4, EVD-2.4a, EVD-2.5, EVD-2.6, EVD-2.8, EVD-2.9, EVD-2.10_
  - [x]* 5.2 Write unit tests for the coverage resolver
    - Create `tests/evidence/coverage.test.ts`
    - `city_site` when a `grouping = "city"` row exists (Toronto); `site_only` when only site rows; `no_city_site` + Ontario aggregate when `locationId = "ottawa"` (Gazetteer city, no PHAC rows, province row present); `no_city_site` + `unknownReason: "aggregate_below_coverage"` when no province row; `unknown` when neither Gazetteer nor PHAC; Charlottetown alias resolves correctly
    - Use parsed observations from `fixtures/trend-oct-2026.real.csv` via `parseTrend`
    - _Requirements: EVD-2.7_
  - [x] 5.3 Verify `npm run typecheck && npm run test` exit 0

- [x] 6. Timing classifier
  - [x] 6.1 Create `src/evidence/timing.ts`
    - Implement `classifyTiming(eventDate: string, today: Date | string): TimingState`; `diff = calendarDayDiff(toTorontoDateString(today), toTorontoDateString(eventDate))`; `diff > 21` → `"too_early"` · `diff 0–21` → `"near"` · `diff < 0` → `"past"`; no `new Date()` inside
    - _Requirements: EVD-3.1, EVD-3.2, EVD-3.3, EVD-3.4_
  - [x]* 6.2 Write unit and property tests for the timing classifier
    - Create `tests/evidence/timing.test.ts`
    - Boundary tests: 22 days ahead → `"too_early"`, 21 days ahead → `"near"`, diff = 0 → `"near"`, yesterday → `"past"`
    - Property P3 (fast-check, min 100 runs): FOR ALL event dates > 21 days after `today`, `classifyTiming` returns `"too_early"`; test name: `"EVD-3 P3: events beyond 21 days are always too_early"`
    - _Requirements: EVD-3.2, EVD-3.3, EVD-3.4_
  - [x] 6.3 Verify `npm run typecheck && npm run test` exit 0

- [x] 7. Wording guard
  - [x] 7.1 Create `src/evidence/wording-guard.ts`
    - Export `WordingCheckResult` interface: `{ passed: boolean; violations: string[] }`
    - Implement `checkWording(text: string): WordingCheckResult` — two-step: (1) replace allowlisted phrases with equal-length placeholders before scanning; (2) scan with whole-word `\b` regex per banned term; empty string → `{ passed: true, violations: [] }`; all violations in one pass; pure function; no logging/throwing
    - Allowlist (must NOT trigger violations): `"not a prediction"`, `"not a forecast"`, `"no-forecast"`, `"not conditions on your date"`, `"not on your event date"`, `"too early to know — not conditions on your date"`
    - Banned terms: `safe`, `unsafe`, `dangerous`, `risk-free`, `you will get sick`, `you won't get sick`, `% chance` (pattern `/\d+\s*%\s*chance/i` and `/percent\s+chance/i` — `\b` does not work before `%`), `probability of infection`, `will be high`, `will be low`, `forecast for your event`, `predict`, `prediction`, `no infections`, `virus-free`, `all clear`, `PHAC endorses`, `endorsed by PHAC`, `recommended by PHAC`
    - _Requirements: EVD-7.1, EVD-7.2, EVD-7.3, EVD-7.4, EVD-7.4a, EVD-7.5, EVD-7.6, EVD-7.7, EVD-7.8_
  - [x]* 7.2 Write unit tests for the wording guard
    - Create `tests/evidence/wording-guard.test.ts`
    - Passing: empty string, `"safety instructions"` (word-boundary: "safety" ≠ "safe"), `"unpredictable weather"`, `"past observations, not a prediction"` (allowlist), `"not conditions on your date"` (allowlist)
    - Failing: `"Toronto is safe for your dinner"`, `"forecast for your event next week"`, `"50% chance of getting sick"`, `"there is a probability of infection"`, `"PHAC endorses this app"`
    - All six `PREVENTION_CHECKLIST.items` pass the guard
    - _Requirements: EVD-7.2, EVD-7.3, EVD-7.4, EVD-7.4a_
  - [x] 7.3 Verify `npm run typecheck && npm run test` exit 0

- [x] 8. EventCard builder
  - [x] 8.1 Create `src/evidence/card.ts`
    - Implement `buildCard(input: CardBuilderInput, data: CardBuilderData): EventCard` — pure function; identical inputs → identical output; no side effects
    - Call `classifyTiming(input.eventDate, input.today)` → `timingState`; derive `isGazetteerCity` and `pruid` from `data.locationEntry`; call `resolveCoverage` → coverage; call `classifyFreshness` on most-recent observation → `freshnessLabel`
    - For `"near"`: build `NearStatement[]` — 4 entries (one per pathogen); `activityIndex` verbatim from `StatusObservation`; missing obs → `activityIndex: "unknown"`, `unknownReason: "missing_row"`
    - For `"too_early"`: build `HistoricalContext[]` — use `dateToEpiWeek(input.eventDate)` to find matching `MeasuredWeek`; include `histMin`/`histMax` only; no `wAvg`, no `activityIndex`, no `trend`; `label = "past observations, not a prediction"`; missing week → nulls (gap, never interpolated)
    - For `"past"`: build `HistoricalContext[]` — use `dateToEpiWeek(input.eventDate)`; include `wAvg`, `histMin`, `histMax`, `weekStart`; no activityIndex from `StatusObservation`; missing week → gap (nulls)
    - Always attach `PREVENTION_CHECKLIST` unmodified on every card (all timing states and coverage types)
    - `attendeeCategories` stored on `EventCard.attendeeCategories` for local rendering ONLY — never passed to any other function, never in serialized output, never logged
    - Embed `snapshotId`, `sourceUrl`, `weekStart`, `ruleId` on every statement
    - _Requirements: EVD-4.1, EVD-4.2, EVD-4.3, EVD-4.4, EVD-4.5, EVD-4.6, EVD-4.7, EVD-4.8, EVD-4.9, EVD-4.10, EVD-3.5, EVD-3.6, EVD-3.7, EVD-3.8, EVD-3.9, EVD-10.3_
  - [x]* 8.2 Write unit and property tests for the EventCard builder
    - Create `tests/evidence/card.test.ts`
    - **Halifax Christmas card** (`eventDate: "2026-12-25"`, `today: "2026-10-31"`, 55 days ahead): `timingState === "too_early"`, zero statements have an `activityIndex` field, every statement is `HistoricalContext` with `label === "past observations, not a prediction"`; test name: `"EVD-4: Halifax Christmas card is too_early with only historical context"`
    - **Toronto next-Saturday** (`eventDate: "2026-11-07"`, `today: "2026-10-31"`, 7 days ahead): `timingState === "near"`, `activityIndex` values match Oct-18 fixture values verbatim; test name: `"EVD-4: Toronto next-Saturday card shows real Oct-18 values"`
    - **Ottawa no-site** (any near date): `coverageType === "no_city_site"`, `regionalObservation` is Ontario province row, no Toronto values substituted; test name: `"EVD-4: Ottawa card offers Ontario aggregate labelled regional"`
    - Property P2 (fast-check, min 100 runs): `activityIndex === "unknown"` obs never produce `activityIndex: "low"` or `"not_detected"` on card; test name: `"EVD-4 P2: NA/missing observations never yield low or not_detected"`
    - Property P3 (fast-check, min 100 runs): event dates > 21 days ahead produce zero statements with `interpretationMethod: "publisher"` and zero `activityIndex` or `trend` values; test name: `"EVD-4 P3: too_early cards contain zero activityIndex statements"`
    - Property P6 (fast-check, min 100 runs): for near cards, `statement.activityIndex` equals `StatusObservation.activityIndex` exactly; test name: `"EVD-4 P6: activityIndex always equals source Viral_Activity_Level — oct-2026 fixture"`
    - Use parsed real observations from `fixtures/trend-oct-2026.real.csv` and `fixtures/aggregate-oct-2026.real.csv`
    - _Requirements: EVD-4.1, EVD-4.3, EVD-4.4, EVD-4.9, EVD-4.10, EVD-3.7, EVD-3.8_
  - [x] 8.3 Verify `npm run typecheck && npm run test` exit 0

- [x] 9. Share text generator
  - [x] 9.1 Create `src/evidence/share.ts`
    - Implement `generateShareText(card: EventCard): string` — deterministic; identical inputs → identical output
    - For `"near"`: location name, event date, per-pathogen (virus name + PHAC classification + `"as of week of {humanDate}, not on your event date"`), source URL, no-forecast caveat; render `weekStart` as human-readable e.g. `"Oct 18, 2026"`
    - For `"past"`: `"observed week of {humanDate}"`, source URL, no-forecast caveat; NO PHAC classification labels
    - For `"too_early"`: per-pathogen historical min/max context where present, `"too early to know — not conditions on your date"`, source URL, no-forecast caveat; NO `activityIndex` or trend values
    - NEVER include `attendeeCategories` values in output; does NOT call `checkWording` internally
    - _Requirements: EVD-5.1, EVD-5.2, EVD-5.3, EVD-5.4, EVD-5.5, EVD-5.6, EVD-5.7, EVD-5.8_
  - [x]* 9.2 Write unit and property tests for the share text generator
    - Create `tests/evidence/share.test.ts`
    - `"near"` card: output contains `"as of week of Oct 18, 2026, not on your event date"` and source URL
    - `"past"` card: output contains `"observed week of"` and does NOT contain any PHAC activity level label (`"High"`, `"Moderate"`, `"Low"`, `"Not Detected"`)
    - `"too_early"` card: output contains `"too early to know — not conditions on your date"`
    - All three timing states: output passes `checkWording`
    - Determinism: calling twice with the same card produces identical strings
    - Property P8 (fast-check, min 100 runs): attendee categories never appear as substrings in share text; test name: `"EVD-5 P8: share text never contains attendee categories"`
    - _Requirements: EVD-5.1, EVD-5.2, EVD-5.3, EVD-5.4, EVD-5.5, EVD-5.6_
  - [x] 9.3 Verify `npm run typecheck && npm run test` exit 0

- [x] 10. Saved-event diff engine
  - [x] 10.1 Create `src/evidence/diff.ts`
    - Implement `diffCards(baseline: EventCard, current: EventCard): DiffResult` — pure function; one `DiffEntry` per pathogen in either card
    - Classification priority: (1) same `weekStart` + different `snapshotId` → `"revised"` (include both snapshotIds); (2) same `snapshotId` + identical value → `"unchanged"`; (3) different `weekStart` or value → `"changed"` (description: `"newer observation: {old} → {new}"`); (4) pathogen absent from current or field null in current was present in baseline → `"newly_missing"`
    - `description` strings MUST NOT contain `"increasing"`, `"decreasing"`, `"rising"`, or `"falling"` — use `"{old} → {new}"` only
    - _Requirements: EVD-6.1, EVD-6.2, EVD-6.3, EVD-6.4, EVD-6.5, EVD-6.6, EVD-6.7, EVD-6.8, EVD-6.9_
  - [x]* 10.2 Write unit and property tests for the diff engine
    - Create `tests/evidence/diff.test.ts`
    - Same card twice → all four pathogen entries `"unchanged"`; same `weekStart` + different `snapshotId` → `"revised"` with both snapshotIds; different `weekStart` + different value → `"changed"`, description contains `"→"`, no increase/decrease words; pathogen absent from current → `"newly_missing"`
    - Property P10 (fast-check, min 100 runs): no `DiffEntry` with `status === "newly_missing"` or `"revised"` ever contains `"increasing"`, `"decreasing"`, `"rising"`, or `"falling"` in its description; test name: `"EVD-6 P10: diff output never uses increase/decrease language for missing or revised fields"`
    - _Requirements: EVD-6.2, EVD-6.3, EVD-6.4, EVD-6.5, EVD-6.6, EVD-6.7, EVD-6.8_
  - [x] 10.3 Verify `npm run typecheck && npm run test` exit 0

- [x] 11. Privacy property test
  - [x] 11.1 Create `tests/evidence/card-privacy.test.ts`
    - Property P11 path A (fast-check, min 100 runs): FOR ALL `EventCard`s with non-empty `attendeeCategories`, `JSON.stringify` of the card with the `attendeeCategories` field deleted does not contain any category value as a substring; test name: `"EVD-8 P11: attendeeCategories never appear in serialized EventCard"`
    - Property P11 path B: `generateShareText(card)` does not contain any `attendeeCategories` value as a substring (cross-referenced from Task 9.2 P8)
    - _Requirements: EVD-8.10, EVD-4.6_
  - [x] 11.2 Verify `npm run typecheck && npm run test` exit 0

- [x] 12. Kiro hooks
  - [x] 12.1 Create `.kiro/hooks/evidence-engine.json` — PostFileSave hook
    - Matcher: `src/evidence/**`; command: `npx vitest run tests/evidence`
    - Format: `{ "version": "v1", "hooks": [{ "name": "Run evidence tests", "trigger": "PostFileSave", "matcher": "src/evidence/**", "action": { "type": "command", "command": "npx vitest run tests/evidence" } }] }`
    - _Requirements: EVD-9.1, EVD-9.4, EVD-9.5, EVD-9.6_
  - [x] 12.2 Create `.kiro/hooks/wording-guard.json` — PostFileSave hook
    - Matcher: `src/evidence/copy/**`; command: `npx vitest run tests/evidence/wording-guard.test.ts`
    - _Requirements: EVD-9.2, EVD-9.4, EVD-9.5, EVD-9.6_
  - [x] 12.3 Create `.kiro/hooks/ingestion-watch.json` — PostFileSave hook
    - Matcher: `src/server/ingest/**`; command: `npx vitest run tests/ingest tests/properties`
    - _Requirements: EVD-9.3, EVD-9.4, EVD-9.5, EVD-9.6_
  - [x] 12.4 Verify all 3 hook files exist in `.kiro/hooks/` with correct JSON structure

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - `npm run typecheck` exits 0 across all new files
  - `npm run test` exits 0 — all evidence tests + all 51 existing ingestion tests green
  - All 7 property tests (P1, P2, P3, P6, P8, P10, P11) present and green
  - All test names reference EVD requirement IDs per EVD-8.2
  - Log this session in `docs/KIRO_USAGE.md`

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP, but all properties must eventually pass before merging
- All tasks produce pure TypeScript modules; no I/O inside `src/evidence/`
- `today` is always injected; no `new Date()` inside any evidence function
- Test names must reference EVD requirement IDs per EVD-8.2
- Real fixtures at `fixtures/trend-oct-2026.real.csv` and `fixtures/aggregate-oct-2026.real.csv`; parse in test setup via `parseTrend` / `parseAggregate` from `src/server/ingest/` — evidence modules do no parsing
- Design review adjustments to apply during implementation: human-readable dates in share text (render `weekStart` as `"Oct 18, 2026"`); `resolveCoverage` takes `isGazetteerCity: boolean` + optional `pruid?: string`; EpiWeek matching finds Sunday on or before the event date; wording-guard `% chance` uses `/\d+\s*%\s*chance/i`; Halifax acceptance test uses `eventDate: "2026-12-25"` (55 days ahead of `2026-10-31`)
- Keep all 51 existing ingestion tests green throughout development

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "12.1", "12.2", "12.3"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.2"] },
    { "id": 2, "tasks": ["4.1", "5.1", "6.1", "7.1"] },
    { "id": 3, "tasks": ["4.2", "5.2", "6.2", "7.2"] },
    { "id": 4, "tasks": ["4.3", "5.3", "6.3", "7.3"] },
    { "id": 5, "tasks": ["8.1"] },
    { "id": 6, "tasks": ["8.2"] },
    { "id": 7, "tasks": ["8.3", "9.1", "10.1"] },
    { "id": 8, "tasks": ["9.2", "10.2"] },
    { "id": 9, "tasks": ["9.3", "10.3", "12.4"] },
    { "id": 10, "tasks": ["11.1"] },
    { "id": 11, "tasks": ["11.2"] }
  ]
}
```
