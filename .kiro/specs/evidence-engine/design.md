# Evidence Engine — Design

**Spec:** evidence-engine  
**References:** `docs/BUILD_PLAN.md` v2.2 §4 §6 §8; `.kiro/steering/architecture.md`; `.kiro/steering/scientific-integrity.md`; `.kiro/steering/wording-safety.md`; `.kiro/steering/coding-and-testing.md`

---

## Overview

The evidence engine is a set of pure, deterministic TypeScript modules in `src/evidence/`. It transforms normalized PHAC wastewater data into UI-ready structures — `EventCard`, share text, and field-level diffs — without performing any I/O, network calls, or reading the clock. All timestamps and `today` are injected parameters.

**Design constraints:**
- No `import` from `src/server/` inside `src/evidence/` — evidence modules receive data as parameters.
- No `new Date()` inside any evidence function; `today` is always an injected `Date | string`.
- No re-classification of PHAC values; `activityIndex` always equals the source `Viral_Activity_Level` verbatim.
- `attendeeCategories` stays inside `EventCard` for local rendering; it never enters any serialized output.

---

## Architecture

```
src/evidence/
├── types.ts              # existing — Pathogen, Activity, StatusObservation, MeasuredWeek, etc.
├── card-types.ts         # new — FreshnessLabel, TimingState, EventCard, DiffResult, etc.
├── freshness.ts          # EVD-1
├── coverage.ts           # EVD-2
├── timing.ts             # EVD-3
├── card.ts               # EVD-4 (orchestrates freshness, coverage, timing)
├── share.ts              # EVD-5
├── diff.ts               # EVD-6
├── wording-guard.ts      # EVD-7
├── date-utils.ts         # America/Toronto date arithmetic (shared by freshness + timing)
└── copy/
    └── checklist.ts      # EVD-10

tests/evidence/
├── freshness.test.ts
├── coverage.test.ts
├── timing.test.ts
├── card.test.ts
├── share.test.ts
├── diff.test.ts
├── wording-guard.test.ts
└── card-privacy.test.ts
```

---

## Data Models

Existing types in `src/evidence/types.ts` (`Pathogen`, `Activity`, `Direction`, `UnknownReason`, `StatusObservation`, `MeasuredWeek`, `CoverageStatus`, `LocationEntry`) are referenced as-is; do not redefine them.

```ts
import type {
  Pathogen, Activity, Direction, UnknownReason,
  StatusObservation, CoverageStatus,
} from "./types";

// EVD-1 output
export type FreshnessLabel =
  | "latest_available"
  | "delayed"
  | "outdated"
  | "no_data";

// EVD-3 output
export type TimingState = "too_early" | "near" | "past";

// EVD-2 output
export type CoverageResult =
  | { coverage: "city_site" | "site_only" | "national" }
  | {
      coverage: "no_city_site";
      regional?: StatusObservation;   // province-level row, labelled regional: true
      unknownReason?: UnknownReason;  // "aggregate_below_coverage" when no province row
    }
  | { coverage: "unknown" };

// Statement variant for timingState = "near"
export interface NearStatement {
  pathogen: Pathogen;
  activityIndex: Activity;            // verbatim Viral_Activity_Level — never re-classified
  signalLevel: Activity;
  trend: Direction;
  weekStart: string;                  // ISO date YYYY-MM-DD
  freshnessLabel: FreshnessLabel;
  snapshotId: string;
  sourceUrl: string;
  ruleId: string;                     // e.g. "EVD-4.3"
  interpretationMethod: "publisher";
}

// Statement variant for timingState = "too_early" | "past"
export interface HistoricalContext {
  pathogen: Pathogen;
  epiWeek: number;
  histMin: number | null;
  histMax: number | null;
  wAvg?: number | null;       // present only for timingState = "past"
  weekStart?: string;         // present only for timingState = "past"
  label: "past observations, not a prediction";
  snapshotId: string;
  sourceUrl: string;
  ruleId: string;
}

// EVD-4 output — the central structure produced by Card_Builder
export interface EventCard {
  locationId: string;
  locationName: string;
  eventDate: string;                  // YYYY-MM-DD
  setting: string;
  timingState: TimingState;
  coverageType: CoverageStatus;
  freshnessLabel: FreshnessLabel;     // derived from the most recent observation
  createdAt: string;                  // ISO timestamp — injected, never new Date()
  statements: NearStatement[] | HistoricalContext[];  // 4 entries, one per Pathogen
  regionalObservation?: StatusObservation;            // present when coverageType = "no_city_site"
  preventionChecklist: PreventionChecklist;           // EVD-10; always included, unmodified
  attendeeCategories: string[];       // local rendering only — NEVER serialized to network/export
  snapshotId: string;
  sourceUrl: string;
}

// EVD-6 output
export type DiffStatus = "unchanged" | "changed" | "revised" | "newly_missing";

export interface DiffEntry {
  pathogen: Pathogen;
  status: DiffStatus;
  baselineValue?: string;         // e.g. activityIndex as string
  newValue?: string;
  baselineSnapshotId?: string;
  newSnapshotId?: string;
  baselineWeekStart?: string;
  newWeekStart?: string;
  description?: string;           // e.g. "newer observation: Moderate → High"
                                  // NEVER contains "increasing" or "decreasing"
}

export interface DiffResult {
  locationId: string;
  eventDate: string;
  entries: DiffEntry[];
  baselineSnapshotId: string;
  currentSnapshotId: string;
}

// EVD-10
export interface PreventionChecklist {
  readonly items: readonly string[];
  readonly sourceUrl: string;
  readonly reviewedOn: string;    // ISO date
}
```

---

## 4. Date arithmetic (`src/evidence/date-utils.ts`)

Used by both `freshness.ts` (EVD-1) and `timing.ts` (EVD-3). No `new Date()` at call sites inside evidence modules; callers inject `today`.

```ts
/**
 * Convert a Date or ISO date string to a wall-clock date string in
 * America/Toronto ("YYYY-MM-DD"). Passing a date-only string appends
 * T12:00:00Z before converting, which avoids midnight UTC straddling a
 * different Toronto calendar day.
 */
export function toTorontoDateString(d: Date | string): string {
  const date =
    typeof d === "string"
      ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d)
      : d;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // "YYYY-MM-DD"
}

/**
 * Calendar-day difference between two Toronto date strings.
 * Returns (to - from) in whole days. Both inputs must be "YYYY-MM-DD".
 * Uses noon-UTC anchoring on both sides so DST never shifts the count.
 */
export function calendarDayDiff(from: string, to: string): number {
  const ms =
    new Date(`${to}T12:00:00Z`).getTime() -
    new Date(`${from}T12:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}
```

DST is sidestepped entirely: both endpoints are independently converted to Toronto calendar-date strings before arithmetic, then compared as date-only values via noon-UTC anchored millisecond math.

---

## Components and Interfaces

### `freshness.ts` (EVD-1)

```ts
import type { Activity, UnknownReason } from "./types";
import type { FreshnessLabel } from "./card-types";

/**
 * Classify the freshness of a PHAC observation.
 *
 * @param weekStart     ISO date YYYY-MM-DD from the observation (may be null/undefined/invalid).
 * @param latestTrend   The raw latestTrend string from the PHAC source row.
 * @param activityIndex The normalized activityIndex of the observation.
 * @param unknownReason If activityIndex is "unknown", the reason code.
 * @param today         Injected wall-clock date; NEVER call new Date() inside this function.
 */
export function classifyFreshness(
  weekStart: string | null | undefined,
  latestTrend: string | null | undefined,
  activityIndex: Activity,
  unknownReason: UnknownReason | undefined,
  today: Date | string,
): FreshnessLabel;
```

Decision ladder (in order):
1. If `weekStart` is absent, null, or not a valid `YYYY-MM-DD` string → `"no_data"`.
2. If `activityIndex === "unknown"` and `unknownReason` is `"na1_new_site"` or `"na2_not_sampling"` → `"no_data"`.
3. If `latestTrend === "No Recent Data"` → `"outdated"`.
4. Compute `age = calendarDayDiff(toTorontoDateString(weekStart), toTorontoDateString(today))`.
5. `age ≤ 21` → `"latest_available"` · `22–35` → `"delayed"` · `> 35` → `"outdated"`.

### `coverage.ts` (EVD-2)

```ts
import type { StatusObservation } from "./types";
import type { CoverageResult } from "./card-types";

/**
 * Determine the coverage type for a locationId from the current snapshot.
 * Never throws; returns coverage: "unknown" on unexpected input.
 * Never caches; recomputes on every call.
 *
 * @param locationId    The slug to resolve.
 * @param observations  All StatusObservation records from the latest valid snapshot.
 * @param gazetteerId   Optional: the resolved PHAC locationId from the Gazetteer
 *                      (injected by caller using lookupCity — coverage.ts does no I/O).
 */
export function resolveCoverage(
  locationId: string,
  observations: StatusObservation[],
  gazetteerId?: string,
): CoverageResult;
```

Algorithm:
1. Filter `observations` by `locationId` (and `gazetteerId` alias if provided).
2. Collect unique `grouping` values for that location.
3. If any grouping is `"city"` → `{ coverage: "city_site" }`.
4. If only `"site"` groupings (no `"city"`) → `{ coverage: "site_only" }`.
5. If no observations for the location:
   - Scan for a `grouping = "province"` row matching the Gazetteer entry's `pruid`.
   - If found: `{ coverage: "no_city_site", regional: provinceObs }`.
   - If not found: `{ coverage: "no_city_site", unknownReason: "aggregate_below_coverage" }`.
6. On any unexpected state → `{ coverage: "unknown" }`.

The caller (in `src/app/api/` or `card.ts`) is responsible for calling `lookupCity` from `src/server/geo/cities.ts` and injecting `gazetteerId`. Coverage module itself does no I/O.

### `timing.ts` (EVD-3)

```ts
import type { TimingState } from "./card-types";

/**
 * Classify when an event date falls relative to today.
 *
 * @param eventDate  ISO date YYYY-MM-DD of the planned event.
 * @param today      Injected wall-clock date; NEVER call new Date() inside.
 */
export function classifyTiming(
  eventDate: string,
  today: Date | string,
): TimingState;
```

Algorithm:
1. `diff = calendarDayDiff(toTorontoDateString(today), toTorontoDateString(eventDate))`.
2. `diff > 21` → `"too_early"`.
3. `diff >= 0 && diff <= 21` → `"near"`.
4. `diff < 0` → `"past"`.

### `card.ts` (EVD-3, EVD-4, EVD-10)

```ts
import type { StatusObservation, MeasuredWeek, LocationEntry } from "./types";
import type { EventCard } from "./card-types";

export interface CardBuilderInput {
  locationId: string;
  eventDate: string;      // YYYY-MM-DD
  setting: string;
  attendeeCategories: string[];
  createdAt: string;      // ISO timestamp — caller injects this; never new Date() inside buildCard
  today: Date | string;   // wall-clock date for freshness + timing
}

export interface CardBuilderData {
  observations: StatusObservation[];  // latest snapshot, all locations
  history: MeasuredWeek[];            // pre-filtered to locationId × all pathogens
  locationEntry: LocationEntry;       // resolved by caller via resolveLocation()
}

/**
 * Build a complete EventCard from normalized data and injected parameters.
 * Pure function: identical inputs always produce identical output.
 *
 * Delegates:
 *  - classifyTiming()       → timingState
 *  - resolveCoverage()      → coverageType + regionalObservation
 *  - classifyFreshness()    → freshnessLabel
 *  - PREVENTION_CHECKLIST   → preventionChecklist (verbatim, unmodified)
 */
export function buildCard(
  input: CardBuilderInput,
  data: CardBuilderData,
): EventCard;
```

Statement assembly by `timingState`:

| `timingState` | Per-pathogen statement type | `activityIndex` source | Notes |
|---|---|---|---|
| `"near"` | `NearStatement` | Verbatim from `StatusObservation.activityIndex` | If no obs for pathogen: `activityIndex: "unknown"` |
| `"too_early"` | `HistoricalContext` | Not set (no `activityIndex` or `trend` fields) | `histMin`/`histMax` from `MeasuredWeek` for matching `epiWeek`; label = `"past observations, not a prediction"` |
| `"past"` | `HistoricalContext` | Not set | `wAvg` + `histMin`/`histMax` from `MeasuredWeek` for event date's epiWeek; missing week = gap (null values), never interpolated |

`freshnessLabel` is derived from the most recent observation for the location using `classifyFreshness`. For `"too_early"` and `"past"`, the freshness label reflects the age of the latest available snapshot, not the event date.

### `share.ts` (EVD-5)

```ts
import type { EventCard } from "./card-types";

/**
 * Produce a deterministic, PII-free share text string from an EventCard.
 * Does NOT call Wording_Guard internally (EVD-5.7).
 * Does NOT include attendeeCategories in output (EVD-5.5 / P8).
 *
 * @returns A plain-text string suitable for clipboard copy.
 */
export function generateShareText(card: EventCard): string;
```

Output structure by `timingState`:

| Section | `"near"` | `"too_early"` | `"past"` |
|---|---|---|---|
| Header | Location name, event date | Location name, event date | Location name, event date |
| Per-virus | Virus, PHAC classification, "week of {date}" | Omitted | Omitted |
| Temporal caveat | `"as of week of {date}, not on your event date"` | `"too early to know — not conditions on your date"` | `"observed week of {date}"` |
| Source | Source URL | Source URL | Source URL |
| No-forecast caveat | Always included | Always included | Always included |

### `diff.ts` (EVD-6)

```ts
import type { EventCard } from "./card-types";
import type { DiffResult } from "./card-types";

/**
 * Compare a stored baseline EventCard with a newly built one.
 * Pure function. Never describes "newly_missing" or "revised" as a
 * measured increase or decrease.
 *
 * @param baseline  The EventCard saved at the time the user stored their event.
 * @param current   A freshly built EventCard for the same locationId + eventDate.
 */
export function diffCards(
  baseline: EventCard,
  current: EventCard,
): DiffResult;
```

Classification rules (in priority order):

| Condition | `DiffStatus` |
|---|---|
| Same `snapshotId`, identical value | `"unchanged"` |
| Same `weekStart`, different `snapshotId` | `"revised"` — both snapshotIds included; no increase/decrease language |
| Different `weekStart` or value, newer observation | `"changed"` — `description`: `"newer observation: {old} → {new}"` |
| Pathogen present in baseline, absent from current | `"newly_missing"` |
| Field null/absent in current, was present in baseline | `"newly_missing"` |

`description` strings MUST NOT contain the words "increasing", "decreasing", "rising", or "falling". Changes are described as `"{old} → {new}"` only.

### `wording-guard.ts` (EVD-7)

```ts
export interface WordingCheckResult {
  passed: boolean;
  violations: string[];   // matched phrases from the input; all violations in one pass
}

/**
 * Check a string for banned phrases. Pure function; no side effects.
 * Returns all violations found, not just the first.
 * Case-insensitive, whole-word matching.
 * Allowlisted required negations are exempted before scanning.
 *
 * @param text  Any string; empty string returns { passed: true, violations: [] }.
 */
export function checkWording(text: string): WordingCheckResult;
```

Two-step algorithm:
1. Replace each allowlisted phrase (case-insensitive) with an equal-length placeholder token in a working copy of the string. This prevents "not a prediction" from triggering a `prediction` violation.
2. Run a whole-word case-insensitive regex for each banned term against the working copy. Report matched phrases from the original string positions.

Allowlist (substituted before scanning):
- `"not a prediction"`, `"not a forecast"`, `"no-forecast"`, `"not conditions on your date"`, `"not on your event date"`, `"too early to know — not conditions on your date"`

Banned terms (whole-word, case-insensitive):
- `safe`, `unsafe`, `dangerous`, `risk-free`, `you will get sick`, `you won't get sick`, `% chance`, `probability of infection`, `will be high`, `will be low`, `forecast for your event`, `predict`, `prediction`, `no infections`, `virus-free`, `all clear`, `PHAC endorses`, `endorsed by PHAC`, `recommended by PHAC`

Word-boundary rule: `\bterm\b` regex. `"safety"`, `"unpredictable"`, `"unsafe_mode"` do NOT match `"safe"` or `"predict"`.

### `copy/checklist.ts` (EVD-10)

```ts
import type { PreventionChecklist } from "../card-types";

export const PREVENTION_CHECKLIST: PreventionChecklist = {
  items: [
    "Get your recommended vaccines.",
    "Stay home when you're sick.",
    "Wear a well-fitting respirator or mask.",
    "Improve indoor ventilation.",
    "Clean your hands regularly.",
    "Cover your coughs and sneezes.",
  ],
  sourceUrl:
    "https://www.canada.ca/en/public-health/services/diseases/respiratory-infectious-diseases-reduce-spread-personal-protective-measures.html",
  reviewedOn: "2026-10-31",
} as const;
```

Items are verbatim from the PHAC protective-measures page. `Card_Builder` includes the constant unmodified on every card regardless of `timingState` or `coverageType`. Items pass the Wording_Guard (verified at build time by `wording-guard.test.ts`).

---

## 6. EVD requirement → function mapping

| EVD requirement | Module | Function / constant |
|---|---|---|
| EVD-1 (freshness classification) | `freshness.ts` | `classifyFreshness()` |
| EVD-2 (coverage resolution) | `coverage.ts` | `resolveCoverage()` |
| EVD-3 (timing state) | `timing.ts` | `classifyTiming()` |
| EVD-3.5–3.9 (too_early / past card content) | `card.ts` | `buildCard()` |
| EVD-4 (EventCard assembly) | `card.ts` | `buildCard()` |
| EVD-5 (share text) | `share.ts` | `generateShareText()` |
| EVD-6 (saved-event diff) | `diff.ts` | `diffCards()` |
| EVD-7 (wording guard) | `wording-guard.ts` | `checkWording()` |
| EVD-8 (property-based tests) | `tests/evidence/` | All `*.test.ts` files |
| EVD-9 (Kiro hooks) | `.kiro/hooks/` | Three `PostFileSave` hooks |
| EVD-10 (prevention checklist) | `copy/checklist.ts` | `PREVENTION_CHECKLIST` |
| Date arithmetic (EVD-1, EVD-3) | `date-utils.ts` | `toTorontoDateString()`, `calendarDayDiff()` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Ingest time does not affect freshness label (P1)

*For any* valid `StatusObservation`, changing only the `fetchedAt` / ingest timestamp while keeping `weekStart` and `today` constant SHALL produce an identical freshness label.

**Validates: Requirements 1.7, 1.8**

### Property 2: Missing or NA observations never yield `low` or `not_detected` (P2)

*For any* `StatusObservation` where `activityIndex` is `"unknown"` (including `unknownReason = "na1_new_site"`, `"na2_not_sampling"`, or `"missing_row"`), the corresponding card statement's `activityIndex` SHALL never be `"low"` or `"not_detected"`.

**Validates: Requirements 4.4, 4.10**

### Property 3: Too-early cards contain zero publisher statements (P3)

*For any* event date more than 21 calendar days after `today`, the `EventCard` produced by `buildCard()` SHALL contain zero statements with `interpretationMethod: "publisher"` and SHALL contain zero `activityIndex` or `trend` field values.

**Validates: Requirements 3.2, 3.5, 3.7, 3.8**

### Property 4: Activity index is always verbatim from source (P6)

*For any* `StatusObservation` used to build a `"near"` card, the `NearStatement.activityIndex` SHALL equal the `activityIndex` field of that `StatusObservation` exactly — no re-classification, interpolation, or substitution.

**Validates: Requirements 4.3, 4.9**

### Property 5: Share text never contains attendee categories (P8)

*For any* `EventCard` whose `attendeeCategories` array is non-empty, the string returned by `generateShareText(card)` SHALL contain none of those category values as substrings.

**Validates: Requirements 5.5, 5.6**

### Property 6: Diff output never uses increase/decrease language for missing or revised fields (P10)

*For any* baseline/current `EventCard` pair, the `DiffResult` produced by `diffCards()` SHALL never contain the words `"increasing"`, `"decreasing"`, `"rising"`, or `"falling"` in any `DiffEntry.description` where `status` is `"newly_missing"` or `"revised"`.

**Validates: Requirements 6.5, 6.6, 6.7, 6.8**

### Property 7: Attendee categories never appear in serialized output (P11)

*For any* `EventCard` with non-empty `attendeeCategories`, calling `JSON.stringify()` on the `EventCard` minus the `attendeeCategories` field itself, and calling `generateShareText()`, SHALL produce strings that contain none of those category values as substrings. The `attendeeCategories` field SHALL be stripped before any output intended for a network boundary, export, or log.

**Validates: Requirements 4.6, 8.10**

---

## Error Handling

| Scenario | Module | Behaviour |
|---|---|---|
| `weekStart` is null/invalid | `freshness.ts` | Return `"no_data"` — never throw |
| `resolveCoverage` for unknown locationId | `coverage.ts` | Return `{ coverage: "unknown" }` — never throw |
| No `MeasuredWeek` for an event's epiWeek | `card.ts` | `histMin`/`histMax`/`wAvg` set to `null`; statement marked as gap, not interpolated |
| No `StatusObservation` for a pathogen | `card.ts` | `activityIndex: "unknown"`, `unknownReason: "missing_row"` |
| Empty string passed to `checkWording` | `wording-guard.ts` | Return `{ passed: true, violations: [] }` |
| `diffCards` receives cards with no shared pathogens | `diff.ts` | All baseline pathogens marked `"newly_missing"`; no exception thrown |

All evidence functions are total (no thrown exceptions on malformed-but-typed input).

---

## Testing Strategy

### Overview

Unit and property-based tests using [Vitest](https://vitest.dev/) + [fast-check](https://fast-check.dev/). Property tests run minimum 100 iterations each. Test names reference fixture retrieval dates and EVD requirement IDs per EVD-8.2.

Real fixture strategy: parse `fixtures/trend-oct-2026.real.csv` and `fixtures/aggregate-oct-2026.real.csv` in test setup using the existing ingestion parser (`src/server/ingest/parse-trend.ts`, `parse-aggregate.ts`) to obtain `StatusObservation[]` and `MeasuredWeek[]`. These arrays are then passed as injected parameters to the pure evidence functions — no file I/O occurs inside the evidence modules during tests.

### Test files

| Test file | Properties | Fixtures | Notes |
|---|---|---|---|
| `tests/evidence/freshness.test.ts` | P1 (ingest time never changes label) | `fixtures/trend-oct-2026.real.csv` | Unit tests for each threshold boundary; DST edge-case examples |
| `tests/evidence/coverage.test.ts` | — | `fixtures/trend-oct-2026.real.csv` | Unit tests for all 5 coverage types; Ottawa (no city row), Charlottetown (Gazetteer alias) |
| `tests/evidence/timing.test.ts` | P3 (too_early → zero publisher statements) | synthetic | Boundary at exactly 21 days |
| `tests/evidence/card.test.ts` | P2 (NA/missing → never low/not_detected), P3, P4/P6 (activityIndex verbatim) | `fixtures/trend-oct-2026.real.csv` | Key scenarios: Halifax 6-wks-out, Toronto next-Saturday, Ottawa no-site |
| `tests/evidence/share.test.ts` | P5/P8 (no attendee categories in output), share text passes Wording_Guard | synthetic | Determinism: identical card → identical text |
| `tests/evidence/diff.test.ts` | P6/P10 (no increase/decrease in diff descriptions) | synthetic | All 4 DiffStatus variants covered |
| `tests/evidence/wording-guard.test.ts` | — | none | Exhaustive banned-phrase table; allowlist exceptions; word-boundary cases |
| `tests/evidence/card-privacy.test.ts` | P7/P11 (attendeeCategories never in serialized output or share text) | synthetic | JSON.stringify path + generateShareText path |

### Key acceptance scenarios (unit tests)

**Halifax Christmas card** (eventDate: `2026-12-12`, today: `2026-10-31`, 42 days ahead):
- `timingState = "too_early"`
- `statements` contains zero `NearStatement` entries
- Each statement is `HistoricalContext` with `label = "past observations, not a prediction"`
- Share text includes `"too early to know — not conditions on your date"`

**Toronto next Saturday** (eventDate: `2026-11-07`, today: `2026-10-31`, 7 days ahead):
- `timingState = "near"`
- Toronto Oct-18 `activityIndex` values present verbatim from `trend-oct-2026.real.csv`
- Share text contains `"as of week of 2026-10-18, not on your event date"`

**Ottawa no-site card** (any near date):
- `coverageType = "no_city_site"`
- `regionalObservation` present with Ontario province-level data
- No Toronto or other city values substituted

### Property test configuration (fast-check)

Each property test is tagged with a comment in the format:  
`// Feature: evidence-engine, Property {N}: {property_text}`

Minimum 100 iterations per property (`fc.configureGlobal({ numRuns: 100 })`). Properties referencing real fixtures run the arbitraries over the parsed real observation arrays using `fc.constantFrom(...realObservations)`.

---

## 10. Assumptions

| # | Assumption | Source |
|---|---|---|
| A1 | `weekStart` in `StatusObservation` is always an EpiWeek Sunday in `YYYY-MM-DD` format when valid. | BUILD_PLAN §6 L8; `src/evidence/schemas.ts` |
| A2 | `interpretationMethod` on `NearStatement` is always `"publisher"` — we never compute our own classifications. | BUILD_PLAN §6 §8; scientific-integrity steering |
| A3 | `MeasuredWeek.histMin`/`histMax` are PHAC historical extremes across all recorded EpiWeeks, not confidence intervals or forecasts. | BUILD_PLAN §0 row 1, v2.1 amendments |
| A4 | Exactly four pathogens exist: `"covid19"`, `"fluA"`, `"fluB"`, `"rsv"`. A fifth pathogen appearing in source data would require a schema version bump. | `src/evidence/types.ts` |
| A5 | The Gazetteer in `src/server/geo/cities.ts` is the authoritative source for city-name → PHAC-location-name resolution; `coverage.ts` does not re-implement this mapping. | BUILD_PLAN §7, §6 |
| A6 | `attendeeCategories` are broad labels (e.g. `"older adults"`, `"infants"`), never names, ages, or diagnoses. Privacy enforcement is by never including them in any output path, not by sanitization. | BUILD_PLAN §4 §7; privacy steering |
| A7 | `today` is injected by the caller (API route or page component) and is the Toronto wall-clock date at request time. The evidence engine never reads the system clock. | EVD-1.9, EVD-3.1 |

---

## 11. Design review notes (approved with adjustments — apply in tasks.md)

Reviewed 2026-10-31. Design APPROVED; implement with these five adjustments:

1. **Human-readable dates in user-facing copy.** Share text and card labels render `weekStart` as "Oct 18, 2026" (e.g. "as of week of Oct 18, 2026, not on your event date"), not ISO `2026-10-18`. Keep ISO in data fields.
2. **Coverage must know Gazetteer membership.** `resolveCoverage` needs an explicit `isGazetteerCity: boolean` (or the Gazetteer entry itself) so that "no rows + not a Gazetteer city" returns `{ coverage: "unknown" }` per EVD-2.4a — not `no_city_site`.
3. **Week matching for past / too_early.** Map an event date to the EpiWeek whose Sunday `weekStart` is on or before the event date (≤ 6 days earlier); use that EpiWeek's `histMin`/`histMax` (too_early) or that exact `weekStart` row (past). No row → gap.
4. **Wording-guard regex for symbol terms.** `\b` does not work before `%`; match "% chance" with a pattern like `/\d+\s*%\s*chance/i` (plus a plain "percent chance" variant).
5. **Acceptance test date.** The Halifax Christmas scenario uses `eventDate: 2026-12-25` (55 days ahead of 2026-10-31), not Dec 12.
