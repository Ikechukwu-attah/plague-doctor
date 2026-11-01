# Requirements Document

## Introduction

The evidence engine is a set of pure, deterministic TypeScript modules in `src/evidence/` that transform normalized PHAC wastewater data into UI-ready structures. It performs no I/O, makes no network calls, and runs entirely client-side. It covers eight functional areas: freshness classification, coverage resolution, timing state, EventCard assembly, share text generation, saved-event diff, wording guard, property-based tests, and Kiro development hooks.

**Spec:** evidence-engine  
**Prefix:** EVD-  
**Scope:** Pure, deterministic TypeScript in `src/evidence/` — no I/O, no UI, no network access. All logic runs client-side.  
**Source of truth:** `docs/BUILD_PLAN.md` v2.2 (§4, §6, §8); all steering docs in `.kiro/steering/`.

---

## Glossary

- **Evidence_Engine**: The set of pure, deterministic TypeScript modules in `src/evidence/` that transform normalized PHAC data into UI-ready structures without performing I/O.
- **Freshness_Classifier**: The module that maps an observation's age (in calendar days, America/Toronto) to a freshness label.
- **Coverage_Resolver**: The module that determines, for a given `locationId`, which PHAC coverage type applies.
- **Timing_Guard**: The module that classifies an event date relative to the latest observation.
- **Card_Builder**: The module that assembles an `EventCard` from normalized data and injected parameters.
- **Share_Generator**: The module that produces deterministic, PII-free share text from an `EventCard`.
- **Diff_Engine**: The module that compares a stored baseline `EventCard` with a newly built one and reports field-level changes.
- **Wording_Guard**: The module that inspects any string for banned phrases defined in `.kiro/steering/wording-safety.md`.
- **EventCard**: The output structure of the Card_Builder, containing per-virus statements, timing state, coverage type, freshness label, and provenance fields.
- **EpiWeek_Sunday**: The ISO date (`YYYY-MM-DD`) of the Sunday that starts an epidemiological week, as published in the PHAC source files under the `weekStart` column.
- **today**: A calendar date injected as a parameter, never derived from `new Date()` inside any Evidence_Engine function.
- **StatusObservation**: The normalized record from a trend snapshot (defined in `docs/BUILD_PLAN.md` §6).
- **MeasuredWeek**: The normalized record from the aggregate file (defined in `docs/BUILD_PLAN.md` §6).
- **Pathogen**: One of `"covid19" | "fluA" | "fluB" | "rsv"`.
- **Activity**: One of `"high" | "moderate" | "low" | "not_detected" | "unknown"`.
- **Direction**: One of `"increasing" | "stable" | "decreasing" | "unknown"`.
- **Gazetteer**: The committed mapping in `src/server/geo/cities.ts` that resolves city names to PHAC location names, province, and `pruid`.

---

## Requirements

### EVD-1 — Freshness classification

**User Story:** As a user, I want to see how fresh a wastewater observation is, so that I can understand whether the data reflects conditions likely to be relevant today.

#### Acceptance Criteria

1. WHEN the Freshness_Classifier receives a `weekStart` value and an injected `today` date, THE Freshness_Classifier SHALL compute the age in calendar days using the `America/Toronto` timezone and SHALL NOT call `new Date()` internally.
2. WHEN the computed age is ≤ 21 calendar days, THE Freshness_Classifier SHALL return `"latest_available"`.
3. WHEN the computed age is between 22 and 35 calendar days (inclusive), THE Freshness_Classifier SHALL return `"delayed"`.
4. WHEN the computed age is > 35 calendar days, THE Freshness_Classifier SHALL return `"outdated"`.
5. WHEN the `latestTrend` field of the observation equals `"No Recent Data"`, THE Freshness_Classifier SHALL return `"outdated"` regardless of the computed age.
6. WHEN `weekStart` is absent, null, or not a valid ISO date, THE Freshness_Classifier SHALL return `"no_data"`.
6a. WHEN the observation's `Viral_Activity_Level` is `NA1` or `NA2` (activity `unknown` with reason `na1_new_site` or `na2_not_sampling`), THE Freshness_Classifier SHALL return `"no_data"` regardless of the computed age (BUILD_PLAN §6).
7. THE Freshness_Classifier SHALL never return `"latest_available"`, `"delayed"`, or `"outdated"` based on a fetch time, ingest time, or any timestamp other than `weekStart`.
8. FOR ALL valid `weekStart` values and injected `today` dates, changing only the ingest timestamp of the same observation SHALL produce an identical freshness label (round-trip / idempotence property: P1).
9. THE Freshness_Classifier SHALL accept `today` as a required parameter of type `Date` or ISO date string; any overload that omits `today` SHALL be a compile-time error.

---

### EVD-2 — Coverage resolution

**User Story:** As a user, I want to know whether my city has a PHAC monitoring site, so that the app can show me relevant data or explain why it cannot.

#### Acceptance Criteria

1. WHEN the Coverage_Resolver receives a `locationId` and a set of `StatusObservation` records from the latest valid snapshot, THE Coverage_Resolver SHALL classify the coverage type without using any hardcoded city availability list.
2. WHEN a `StatusObservation` with `grouping = "city"` exists for the resolved location, THE Coverage_Resolver SHALL return `coverage: "city_site"`.
3. WHEN only `StatusObservation` records with `grouping = "site"` exist for the resolved location (and none with `grouping = "city"`), THE Coverage_Resolver SHALL return `coverage: "site_only"`.
4. WHEN the `locationId` is a Gazetteer city AND no `StatusObservation` exists for it at any grouping, THE Coverage_Resolver SHALL return `coverage: "no_city_site"`.
4a. WHEN the `locationId` is neither a PHAC location in the current snapshot nor a Gazetteer city, THE Coverage_Resolver SHALL return `coverage: "unknown"` (the API responds 404).
5. WHEN the coverage type is `"no_city_site"` and a `StatusObservation` with `grouping = "province"` exists for the matching `pruid`, THE Coverage_Resolver SHALL include that observation labelled `regional: true` in the response.
6. WHEN the coverage type is `"no_city_site"` and no matching province row exists, THE Coverage_Resolver SHALL set `unknownReason: "aggregate_below_coverage"` in the response.
7. WHEN a city name matches a PHAC location name via the Gazetteer (e.g., `"charlottetown"` resolves to `"City of Charlottetown and Town of Stratford"`), THE Coverage_Resolver SHALL resolve to that PHAC location rather than returning `"no_city_site"`.
8. WHEN the Coverage_Resolver cannot determine coverage for any reason, THE Coverage_Resolver SHALL return `coverage: "unknown"` rather than throwing an exception.
9. THE Coverage_Resolver SHALL recompute coverage from the snapshot data on every call; it SHALL NOT cache or persist coverage state from a prior snapshot.
10. THE Coverage_Resolver SHALL never substitute a neighbouring city's values for an uncovered city; the regional observation returned SHALL be a PHAC province-level row only.

---

### EVD-3 — Timing state

**User Story:** As a user planning a future event, I want the app to tell me honestly when it is too early to make evidence-based statements, so that I am never shown fabricated conditions.

#### Acceptance Criteria

1. WHEN the Timing_Guard receives an `eventDate` and an injected `today`, THE Timing_Guard SHALL compute the timing state using calendar days in `America/Toronto`; it SHALL NOT call `new Date()` internally.
2. WHEN `eventDate` is more than 21 calendar days after `today`, THE Timing_Guard SHALL return `timingState: "too_early"`.
3. WHEN `eventDate` is between 0 and 21 calendar days after `today` (inclusive of today), THE Timing_Guard SHALL return `timingState: "near"`.
4. WHEN `eventDate` is before `today`, THE Timing_Guard SHALL return `timingState: "past"`.
5. WHEN `timingState` is `"too_early"`, THE Card_Builder SHALL include ONLY labelled historical min/max context for the matching EpiWeek and the general PHAC prevention checklist in the card output; it SHALL NOT include any current-level statement framed as an event condition.
6. WHEN `timingState` is `"too_early"`, THE Card_Builder SHALL label any historical context as `"past observations, not a prediction"`.
7. FOR ALL event dates more than 21 days from `today`, THE Card_Builder SHALL produce a card that contains zero statements with `interpretationMethod: "publisher"` referencing a future date (property P3).
8. WHEN `timingState` is `"too_early"`, the card SHALL carry NO `activityIndex` or `trend` values for any virus — only per-virus historical min/max context for the matching EpiWeek and the prevention checklist (EVD-10).
9. WHEN `timingState` is `"past"`, THE Card_Builder SHALL use the MeasuredWeek history for the event date's EpiWeek (`wAvg` plus historical `histMin`/`histMax`), labelled historical, and SHALL NOT include an official `activityIndex` (PHAC levels exist only for snapshot weeks); a missing week SHALL be shown as a gap, never interpolated.

---

### EVD-4 — EventCard builder

**User Story:** As a user, I want a complete, source-linked card for my gathering, so that I can understand and share what wastewater observations do and do not say about the viruses circulating near my event.

#### Acceptance Criteria

1. WHEN the Card_Builder receives `{ locationId, eventDate, setting, attendeeCategories }` together with normalized snapshot data and an injected `today`, THE Card_Builder SHALL produce an `EventCard` containing one entry per Pathogen (`covid19`, `fluA`, `fluB`, `rsv`). For `timingState: "near"` each entry is a current-observation statement; for `"too_early"` and `"past"` each entry follows EVD-3.8 and EVD-3.9 respectively.
2. THE Card_Builder SHALL set `timingState` using the Timing_Guard (EVD-3), `coverageType` using the Coverage_Resolver (EVD-2), and `freshnessLabel` using the Freshness_Classifier (EVD-1).
3. WHEN `timingState` is `"near"` and a `StatusObservation` exists for the location and pathogen, THE Card_Builder SHALL set `activityIndex` on the statement to the exact `Viral_Activity_Level` value from that observation; it SHALL NOT re-classify, interpolate, or substitute any other value (property P6).
4. WHEN no `StatusObservation` exists for a pathogen at the resolved location, THE Card_Builder SHALL set `activityIndex: "unknown"` for that pathogen and SHALL NOT omit the virus statement entirely.
5. THE Card_Builder SHALL embed `snapshotId`, `sourceUrl`, `weekStart`, and the EVD requirement rule ID that produced each statement on every statement in the `EventCard`.
6. THE Card_Builder SHALL include `attendeeCategories` in the `EventCard` struct for local rendering; THE Card_Builder SHALL NOT pass `attendeeCategories` to any serialization, network call, log, export, or URL construction path (privacy rule, property P11).
7. IF `coverageType` is `"no_city_site"`, THE Card_Builder SHALL include the provincial aggregate observation (if present) labelled `regional: true`; it SHALL NOT populate per-virus statements with province-level values instead of city-level values without explicit labelling.
8. THE Card_Builder SHALL be a pure function: identical inputs SHALL always produce identical outputs with no side effects.
9. FOR ALL valid inputs, the `activityIndex` on every card statement SHALL equal the source `Viral_Activity_Level` from the corresponding `StatusObservation` (property P6).
10. WHEN `activityIndex` is `"unknown"` due to a missing or NA row, THE Card_Builder SHALL set `activityIndex: "unknown"` and SHALL NOT set `activityIndex: "low"` or `activityIndex: "not_detected"` (property P2).

---

### EVD-5 — Share text generation

**User Story:** As a user, I want to copy a clean, factual summary of my gathering card to share with others, so that I can communicate evidence-based observations without exposing personal details.

#### Acceptance Criteria

1. WHEN the Share_Generator receives an `EventCard`, THE Share_Generator SHALL produce a deterministic text string; identical `EventCard` inputs SHALL always produce identical output.
2. THE Share_Generator SHALL include in every output: the location name, the source URL and the no-forecast caveat. For `"near"` cards it SHALL also include each virus name, its PHAC classification label and `"week of {date}"`; for `"too_early"` and `"past"` cards it SHALL NOT include any current PHAC classification.
3. WHEN the card's `timingState` is `"near"`, THE Share_Generator SHALL include the phrase `"as of week of {date}, not on your event date"`; WHEN it is `"past"`, THE Share_Generator SHALL include `"observed week of {date}"`.
4. WHEN the card's `timingState` is `"too_early"`, THE Share_Generator SHALL include the phrase `"too early to know — not conditions on your date"` in the output.
5. THE Share_Generator SHALL never include `attendeeCategories` values, free text entered by the user, or any personally identifying information in its output (property P8).
6. FOR ALL `EventCard` inputs containing non-empty `attendeeCategories`, the share text output SHALL contain none of those category values (property P8).
7. THE Share_Generator SHALL NOT call the Wording_Guard internally; the Wording_Guard (EVD-7) is applied externally before share text is presented in the UI.
8. THE Share_Generator SHALL produce output that passes the Wording_Guard (EVD-7) for all valid inputs; if a generated string would contain a banned phrase, the Share_Generator implementation is defective and the defect SHALL be corrected.

---

### EVD-6 — Saved-event diff

**User Story:** As a returning user, I want to see exactly what changed in the wastewater data since I saved my gathering card, so that I can understand whether conditions have been revised, improved, or are now missing.

#### Acceptance Criteria

1. WHEN the Diff_Engine receives a baseline `EventCard` (stored `snapshotId` + statements) and a newly built `EventCard`, THE Diff_Engine SHALL return a per-statement diff result for every Pathogen present in either card.
2. WHEN a statement value (e.g. `activityIndex`, `trend`) is identical in both cards and both reference the same `snapshotId`, THE Diff_Engine SHALL classify that statement as `"unchanged"`.
3. WHEN the new card's statement has a newer `weekStart` and/or a different value than the baseline, THE Diff_Engine SHALL classify it as `"changed"`, include both values, and any generated copy SHALL read "newer observation: {old} → {new}" without increase/decrease wording.
4. WHEN a Pathogen is present in the baseline card but absent from the newly built card, THE Diff_Engine SHALL classify that entry as `"newly_missing"`.
5. WHEN the `weekStart` is the same but the `snapshotId` differs (PHAC re-published that week), THE Diff_Engine SHALL classify that statement as `"revised"` and SHALL include both `snapshotId` values; it SHALL NOT characterize the change as a measured increase or decrease (property P10).
6. WHEN a field is absent or null in the new card but was present in the baseline, THE Diff_Engine SHALL classify the change as `"newly_missing"` and SHALL NOT describe it as a measured decrease (property P10).
7. THE Diff_Engine SHALL never produce output that describes a `"newly_missing"` or `"revised"` result as `"changing"`, `"increasing"`, or `"decreasing"` (property P10).
8. FOR ALL baseline/new card pairs where only `snapshotId` changed and all statement values are identical, THE Diff_Engine SHALL return `"revised"` for affected statements and SHALL NOT return `"changed"` (property P10).
9. THE Diff_Engine SHALL be a pure function: identical inputs SHALL always produce identical diff output with no side effects.

---

### EVD-7 — Wording guard

**User Story:** As a developer, I want an automated check that rejects any user-facing string containing banned phrases, so that no copy in the app ever makes safety claims, diagnoses, or forecasts that PHAC data cannot support.

#### Acceptance Criteria

1. THE Wording_Guard SHALL accept any string as input and SHALL return `{ passed: boolean; violations: string[] }`.
2. WHEN the input string contains any of the following phrases (case-insensitive), THE Wording_Guard SHALL set `passed: false` and SHALL include the matched phrase in `violations`:
   - `"safe"`, `"unsafe"`, `"dangerous"`, `"risk-free"`
   - `"you will get sick"`, `"you won't get sick"`
   - `"X% chance"`, `"probability of infection"`
   - `"will be high"`, `"will be low"` (when applied to a future date context)
   - `"forecast for your event"`, `"predict"`, `"prediction"` (when applied to future activity)
   - `"no infections"`, `"virus-free"`, `"all clear"`
   - `"PHAC endorses"`, `"endorsed by PHAC"`, `"recommended by PHAC"` (implied endorsement patterns)
3. WHEN the input string contains none of the banned phrases, THE Wording_Guard SHALL return `{ passed: true, violations: [] }`.
4. THE Wording_Guard SHALL perform case-insensitive, whole-word matching; `"Safe"`, `"SAFE"`, and `"safe"` SHALL all trigger a violation, while words that merely contain a banned term (e.g. `"safety"`, `"unpredictable"`) SHALL NOT.
4a. THE Wording_Guard SHALL exempt this allowlist of required negations, which the app MUST be able to display: `"not a prediction"`, `"not a forecast"`, `"no-forecast"`, `"not conditions on your date"`, `"not on your event date"`. Text inside an allowlisted phrase SHALL NOT produce a violation.
5. THE Wording_Guard SHALL be a pure function with no side effects; it SHALL NOT log, throw, or modify any external state.
6. THE Wording_Guard SHALL return all violations found in a single pass, not just the first one.
7. WHEN the input string is empty, THE Wording_Guard SHALL return `{ passed: true, violations: [] }`.
8. THE Wording_Guard SHALL be callable from any module in `src/evidence/` and from test code; it SHALL NOT depend on any I/O, network, or external state.

---

### EVD-8 — Property-based tests

**User Story:** As a developer, I want fast-check property tests covering the evidence engine's correctness guarantees, so that regressions are caught automatically before any commit reaches the main branch.

#### Acceptance Criteria

1. THE Evidence_Engine test suite SHALL include property-based tests written with fast-check, using real PHAC fixture files trimmed with their retrieval date labelled in the filename; synthetic fixtures SHALL have `"synthetic"` in the filename.
2. WHEN any fast-check test uses a real PHAC fixture, the test name SHALL reference the fixture retrieval date and the EVD requirement ID (e.g., `"EVD-1: freshness never depends on ingest time — oct-2026 fixture"`).
3. THE test suite SHALL implement property P1: FOR ALL valid `StatusObservation` inputs, changing only the ingest timestamp SHALL never change the freshness label from a non-`"latest_available"` value to `"latest_available"`.
4. THE test suite SHALL implement property P2: FOR ALL `StatusObservation` inputs where `activityIndex` is `"unknown"` (including NA1, NA2, missing), the card statement SHALL never have `activityIndex: "low"` or `activityIndex: "not_detected"`.
5. THE test suite SHALL implement property P3: FOR ALL event dates more than 21 days ahead of `today`, no statement in the returned `EventCard` SHALL contain a current-level claim for a future date.
6. THE test suite SHALL implement property P6: FOR ALL `StatusObservation` inputs, `card.statements[*].activityIndex` SHALL equal the source `Viral_Activity_Level` from the corresponding observation.
7. THE test suite SHALL implement property P8: FOR ALL `EventCard` inputs with non-empty `attendeeCategories`, the share text output of Share_Generator SHALL contain none of those category values as substrings.
8. Property P9 (replay provenance) is OUT OF SCOPE for this spec and is deferred to the replay milestone.
9. THE test suite SHALL implement property P10: FOR ALL baseline/new card pairs, the Diff_Engine output SHALL never describe a `"newly_missing"` or `"revised"` field as a measured increase or decrease.
10. THE test suite SHALL implement property P11: FOR ALL `EventCard` inputs and all execution paths of Card_Builder and Share_Generator, `attendeeCategories` values SHALL not appear in any serialized output, return value intended for a network boundary, or log entry.
11. WHEN `npm run test` is executed, THE test suite SHALL exit 0 with all EVD property tests green.
12. WHEN a property test catches a real defect during development, THE defect SHALL be recorded in `docs/KIRO_USAGE.md` with the property ID, the failing example, and the fix applied.

---

### EVD-9 — Kiro hooks

**User Story:** As a developer, I want automated hooks that run the relevant test suite whenever I save evidence, copy, or ingestion files, so that correctness and wording-safety regressions surface immediately during development.

#### Acceptance Criteria

1. THE Evidence_Engine hook (a) SHALL be a PostFileSave hook in `.kiro/hooks/` that matches the file path pattern `src/evidence/**`; WHEN any file matching that pattern is saved, it SHALL execute `npx vitest run tests/evidence`.
2. THE Wording_Guard hook (b) SHALL be a PostFileSave hook in `.kiro/hooks/` that matches `src/evidence/copy/**` and `src/**/*.tsx`; WHEN any matching file is saved, it SHALL execute the wording-guard test to verify no banned phrase was introduced.
3. THE Ingestion_Watch hook (c) SHALL be a PostFileSave hook in `.kiro/hooks/` that matches the path patterns `src/server/ingest/**` and `fixtures/**`; WHEN any file matching those patterns is saved, it SHALL execute the ingestion test suite.
4. WHEN any hook command exits with a non-zero code, THE hook output SHALL include the test failure details so the developer sees them immediately in the Kiro session.
5. THE three hooks SHALL be committed to `.kiro/hooks/` and SHALL NOT require any manual configuration step beyond `npm install`.
6. THE hooks SHALL use `npx vitest run` (single execution, not watch mode) so they terminate and return output promptly.

---

### EVD-10 — Prevention checklist

**User Story:** As a user, I want general, official prevention steps on every card, so that I have something useful to do even when the data cannot say much.

#### Acceptance Criteria

1. THE Prevention_Checklist SHALL be a `readonly` data constant in `src/evidence/copy/` containing exactly these items: get your recommended vaccines; stay home when you're sick; wear a well-fitting respirator or mask; improve indoor ventilation; clean your hands regularly; cover your coughs and sneezes.
2. THE constant SHALL include `sourceUrl: "https://www.canada.ca/en/public-health/services/diseases/respiratory-infectious-diseases-reduce-spread-personal-protective-measures.html"` and a `reviewedOn` ISO date recording when the items were last checked against that page.
3. THE Card_Builder SHALL include the checklist, unmodified, on every card (all timing states and coverage types) and SHALL NOT paraphrase, reorder or add items.
4. THE checklist items SHALL pass the Wording_Guard (EVD-7).

---
