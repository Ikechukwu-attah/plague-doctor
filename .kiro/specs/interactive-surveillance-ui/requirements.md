# Requirements Document

## Introduction

This spec covers Milestone 3 of Plague Doctor: the user interface. It delivers five routes (`/`, `/city/[locationId]`, `/plan`, `/card`, `/methods`) and a shared design system, built on the existing read-only APIs in `src/app/api/` and the pure evidence engine in `src/evidence/`. The UI renders PHAC classifications verbatim, never re-classifies, never invents readings, levels, dates or places, and never forecasts. Event cards are built client-side; attendee categories never leave the browser.

**Spec:** interactive-surveillance-ui
**Prefix:** UI-
**Scope:** Next.js App Router pages, components, client state, tests. Includes one additive read-only route `GET /api/history` (decision D1), the injectable normalized-index path and index cleanup (P1), and the past-card EpiYear fix in `buildCard` (P2). Excludes any other ingestion or API changes, any other evidence-engine logic changes, Wayback replay (F11), PNG export (F12), LLM parsing (F13), city comparison, notifications and French UI.
**Source of truth:** `docs/BUILD_PLAN.md` v2.2 (§4, §5, §5A, §6, §8), `docs/MILESTONE_3_KIRO_PROMPT.md`, `design/*.dc.html` (Main, Planner, OmenCard, States, Mobile, Tokens) and all files in `.kiro/steering/`.

---

## Glossary

- **UI**: The Plague_Doctor Next.js front end under `src/app/` and `src/components/`.
- **Design_System**: The shared CSS variables, fonts and primitive components defined by UI-1.
- **Token_Set**: The CSS custom properties for colour, type scale, spacing and radius defined in BUILD_PLAN §5A.
- **LevelBadge**: Component showing a PHAC activity classification as icon, word and colour (hatched for unknown).
- **TrendGlyph**: Component showing a PHAC trend direction as glyph plus word.
- **FreshnessLantern**: Component showing a freshness label by lantern brightness plus text. Brightness encodes freshness only.
- **ThreeClocks**: Component showing sample week, PHAC file last-modified date and our last successful ingest.
- **GuideQuote**: Component showing one-sentence template explanations attributed to the plague-doctor guide.
- **Landing_Page**: Route `/`.
- **Virus_Chips**: The single-select control for COVID-19, Flu A, Flu B and RSV.
- **Canada_Map**: SVG map of Canada with province outlines and city markers.
- **City_List**: The searchable, keyboard-accessible list of locations that provides every function of the Canada_Map.
- **Fog_Layer**: The visual density overlay on a city marker, driven by the selected virus's `activityIndex`.
- **City_Page**: Route `/city/[locationId]`.
- **Timeline_Chart**: Chart of measured `wAvg` with the PHAC historical min/max band.
- **Provenance_Panel**: The "Why does it say this?" panel showing snapshot ID, source field and rule ID.
- **Planner**: Route `/plan`, the five-step stepper (Where, When, Setting, Who, Confirm).
- **Omen_Card**: Route `/card`, the parchment rendering of an `EventCard`.
- **Saved_Event**: An `EventCard` persisted in `localStorage` after explicit opt-in.
- **Methods_Page**: Route `/methods` ("Behind the Mask").
- **Read_API**: The existing `GET /api/locations`, `/api/observations`, `/api/status`, `/api/data-status` and `/api/snapshots` routes.
- **Evidence_Engine**: The pure modules in `src/evidence/` (`buildCard`, `generateShareText`, `diffCards`, `classifyFreshness`, `classifyTiming`, `resolveCoverage`, `checkWording`).
- **Wording_Guard**: `checkWording` in `src/evidence/wording-guard.ts`, which flags banned phrases from `.kiro/steering/wording-safety.md`.
- **Attendee_Categories**: Optional broad categories (older adults, infants, immunocompromised) chosen in the Planner.
- **Screen_States**: The four states every screen defines: loading, empty/no data, error/stale, success.
- **Geometry_File**: The committed simplified GeoJSON of Canadian provinces derived from Natural Earth admin-1.
- **Reduced_Motion**: The browser preference `prefers-reduced-motion: reduce`.
- **Viewport_390**: A viewport 390 CSS pixels wide.
- **Touch_Target**: Any interactive element's hit area.
- **Test_Suite**: The Vitest, fast-check and Playwright tests in the repository.

---

## Requirements

### Requirement 1: Design system tokens and primitives

**User Story:** As a visitor, I want a consistent scientific-gothic look with colour never being the only signal, so that I can read activity, trend and freshness reliably.

#### Acceptance Criteria

1. THE Design_System SHALL define every colour in BUILD_PLAN §5A (`ink-900`, `ink-800`, `ink-700`, `parchment`, `parchment-dim`, `lantern`, `fog-teal`, `level-high`, `level-moderate`, `level-low`, `level-nd`, `level-unknown`, `replay`) as a CSS custom property with the hex value given there.
2. THE Design_System SHALL load Cormorant Garamond (display), Inter (UI) and JetBrains Mono (dates, snapshot IDs, numbers) through `next/font`.
3. THE Design_System SHALL define the type scale 12, 14, 16, 20, 28 and 40 px, the 4-px spacing base and the radii 6, 12 and 20 px.
4. WHEN LevelBadge receives an activity value, THE LevelBadge SHALL render an icon, a word and a colour: ▲▲ "High", ▲ "Moderate", ▽ "Low", ○ "Not detected", and a hatched pattern with "No data" for `unknown`.
5. WHEN LevelBadge receives `unknown`, THE LevelBadge SHALL render the hatched "No data" style and SHALL NOT render any level colour, "Low", "Not detected" or green.
6. WHEN TrendGlyph receives a trend value, THE TrendGlyph SHALL render ↗ "Increasing", → "Stable", ↘ "Decreasing" or ? "Unknown" together with the word.
7. WHEN FreshnessLantern receives a freshness label, THE FreshnessLantern SHALL render a bright lantern for `latest_available`, a dim lantern for `delayed`, an extinguished lantern for `outdated`, and the text "Latest available", "Delayed", "Outdated" or "No data".
8. THE FreshnessLantern SHALL derive its brightness only from the freshness label and SHALL NOT use `activityIndex` or `signalLevel`.
9. WHEN ThreeClocks receives a snapshot status, THE ThreeClocks SHALL render the sample week as "week of {date}", the PHAC file `Last-Modified` date, and our last successful ingest time as three separately labelled values.
10. WHEN GuideQuote renders, THE GuideQuote SHALL show a template sentence of one sentence that passes the Wording_Guard.
11. THE Design_System SHALL render all text and interactive-state colour pairs with a contrast ratio of at least 4.5:1 against the surface they sit on.
12. THE Design_System SHALL render no emoji and no gore imagery.

### Requirement 2: Landing page layout, virus selection and data loading

**User Story:** As a visitor, I want to pick a virus and see Canada's latest PHAC classifications at once, so that I can tell where data exists and how old it is.

#### Acceptance Criteria

1. THE Landing_Page SHALL render the heading "What's in the water?", a one-line limitation statement that the data is community wastewater, and the Virus_Chips.
2. THE Virus_Chips SHALL offer exactly COVID-19, Flu A, Flu B and RSV, with exactly one selected at a time.
3. WHEN the user presses the Left or Right arrow key while a Virus_Chips option has focus, THE Virus_Chips SHALL move focus to the adjacent option and select it.
4. WHEN the user selects a different virus, THE Landing_Page SHALL update the Canada_Map, the City_List, the legend and the freshness footer to that virus in a single render.
5. THE Landing_Page SHALL obtain locations and observations only from the Read_API and SHALL NOT fetch PHAC CSV files from the browser.
6. THE Landing_Page SHALL render a legend listing each LevelBadge variant, including the hatched "No data" variant.
7. THE Landing_Page SHALL render a footer containing ThreeClocks populated from `/api/data-status`.
8. WHILE the Read_API requests are pending, THE Landing_Page SHALL render skeleton list rows and a static fog texture.
9. IF `/api/locations` returns zero locations, THEN THE Landing_Page SHALL render the text "No locations in this snapshot".
10. IF a Read_API request fails or `/api/data-status` reports a stale or rejected latest snapshot, THEN THE Landing_Page SHALL render a banner reading "Showing last verified data from week of {date}" using the sample week returned by the API, and SHALL keep the last verified data visible.
11. IF a Read_API request fails and no earlier data is available, THEN THE Landing_Page SHALL render an error message naming the failed resource and a retry control.

### Requirement 3: Canada map and fog

**User Story:** As a visitor, I want a map whose fog reflects PHAC's activity index for one virus, so that I can scan Canada visually without misreading missing data.

#### Acceptance Criteria

1. THE Canada_Map SHALL render province outlines as SVG from the Geometry_File.
2. THE repository SHALL contain the Geometry_File with a source note naming Natural Earth admin-1 and its public-domain status.
3. THE Canada_Map SHALL place city markers only for locations returned by `/api/locations` whose coordinates exist in the Gazetteer.
4. WHEN a location has `activityIndex` high, moderate, low or not_detected for the selected virus, THE Canada_Map SHALL draw a Fog_Layer whose density increases in the order not_detected, low, moderate, high, with a fixed teal hue.
5. WHEN a location's `activityIndex` is `unknown` or no observation exists for the selected virus, THE Canada_Map SHALL draw a hatched marker and SHALL NOT draw an absent or zero-density Fog_Layer.
6. THE Canada_Map SHALL encode each marker's state with a shape or icon in addition to colour and density, and SHALL give each marker an accessible name containing location, virus, PHAC classification and "week of {date}".
7. THE Canada_Map SHALL derive Fog_Layer density only from `activityIndex` (PHAC `Viral_Activity_Level`) and SHALL NOT use `signalLevel`.
8. THE Landing_Page SHALL provide a "show discontinued sites" toggle that is off by default.
9. WHEN the toggle is on, THE Canada_Map and City_List SHALL include sites that the current snapshot marks with `latestTrend` "No Recent Data" or `NA2`, each labelled with its unknown reason.
10. THE UI SHALL derive which sites count as discontinued from the current snapshot and SHALL NOT hardcode a list of cities or sites.
11. WHEN the user activates a marker by click, tap, Enter or Space, THE Canada_Map SHALL open the City_Page drawer for that location.
12. WHILE Reduced_Motion is active, THE Canada_Map SHALL render the Fog_Layer as a static texture with no drift and instant density changes.
13. WHILE Reduced_Motion is not active, THE Canada_Map SHALL drift the fog on a loop of 12 to 20 seconds and ease density changes over 600 ms.

### Requirement 4: Accessible city list

**User Story:** As a keyboard, screen-reader or mobile user, I want a searchable list that does everything the map does, so that I do not depend on the map.

#### Acceptance Criteria

1. THE City_List SHALL render each location as a row showing location name, province, the selected virus's LevelBadge, TrendGlyph, "week of {date}" and FreshnessLantern with text.
2. THE City_List SHALL function with the Canada_Map absent or failed to render.
3. WHEN the user types in the search field, THE City_List SHALL filter rows by case-insensitive match on location name, city or province using `/api/locations?search=`.
4. WHEN the search matches a Gazetteer city with no PHAC monitoring site, THE City_List SHALL show that city's row labelled "No monitoring site" and SHALL NOT show another city's classification on that row.
5. WHEN the user activates a row, THE City_List SHALL open the City_Page for that location.
6. WHEN the search matches no location, THE City_List SHALL render "No matching locations" and keep the search field focused.
7. THE City_List SHALL be fully operable by keyboard with a visible focus indicator using the lantern colour.
8. WHERE the viewport is narrower than 640 px, THE Landing_Page SHALL show the City_List first and collapse the Canada_Map behind a "Show map" toggle.

### Requirement 5: City page and drawer

**User Story:** As a visitor, I want a city's four viruses with classification, trend and sample week in one place, so that I can inspect what PHAC reports and how old it is.

#### Acceptance Criteria

1. THE City_Page SHALL render for each of the four viruses: LevelBadge for `activityIndex`, a separately labelled signal level for `signalLevel`, TrendGlyph, "week of {date}", FreshnessLantern and the data source link.
2. THE City_Page SHALL show `activityIndex` as the headline classification and `signalLevel` as a secondary labelled item, and SHALL NOT display both in a single UI element.
3. THE City_Page SHALL render PHAC classifications verbatim and SHALL NOT re-classify or compute a trend.
4. WHEN `activityIndex` is `unknown`, THE City_Page SHALL show the unknown reason in words: NA1 as "newly onboarded site, under 12 months of data, awaiting baseline", NA2 as "site stopped sampling, has no recent data, or is not being sampled", and `aggregate_below_coverage` as "aggregate not published (coverage below PHAC threshold)".
5. WHEN `/api/status` returns coverage `no_city_site` with a provincial aggregate, THE City_Page SHALL show a notice such as "No {city} monitoring site" and offer "{Province} (provincial aggregate, PHAC)" labelled as a regional observation.
6. WHEN the user chooses the provincial aggregate, THE City_Page SHALL display the PHAC province row's values labelled as the province and SHALL NOT label them with the city's name.
7. IF coverage is `no_city_site` and no provincial aggregate exists, THEN THE City_Page SHALL show "aggregate not published (coverage below PHAC threshold)" and SHALL NOT show any values.
8. THE City_Page SHALL NOT display values from any location other than the requested location or its PHAC province aggregate.
9. WHERE the viewport is 768 px to 1023 px wide, THE City_Page SHALL appear as a bottom sheet; WHERE the viewport is 1024 px or wider, THE City_Page SHALL appear as a 400 px right drawer on the Landing_Page; WHERE the viewport is narrower than 768 px, activating a city SHALL navigate to the full City_Page route. THE drawer and the sheet SHALL each present exactly one close control and SHALL be positioned fixed or sticky outside the document flow.
10. WHILE the status request is pending, THE City_Page SHALL render skeleton rows for all four viruses.
11. IF the location identifier is unknown (API 404), THEN THE City_Page SHALL render a not-found message and a link to the Landing_Page.
12. WHEN the freshness label is `outdated`, THE City_Page SHALL show the original "week of {date}", the "Outdated" lantern and history only, and SHALL NOT make a current-activity claim.
13. WHEN the freshness label is `delayed`, THE City_Page SHALL show an amber caution with the text "Delayed".

### Requirement 6: Timeline chart

**User Story:** As a visitor, I want to see measured weekly concentration with PHAC's historical extremes, so that I can put the latest week in context without being misled.

#### Acceptance Criteria

1. THE Timeline_Chart SHALL plot measured `wAvg` per `weekStart` from `/api/observations` for the selected location and virus.
2. THE Timeline_Chart SHALL draw a shaded band between `histMin` and `histMax` labelled "Historical minimum and maximum recorded for this EpiWeek, not a typical range or forecast".
3. WHEN a week has `wAvg` null or is absent, THE Timeline_Chart SHALL render a gap with no interpolation or smoothing.
4. THE Timeline_Chart SHALL NOT render any point, line or band beyond the latest `weekStart` returned by the API.
5. THE Timeline_Chart SHALL NOT convert a concentration into a count of people, cases or a risk figure in labels or tooltips.
6. THE Timeline_Chart SHALL show an official activity index only on weeks for which a PHAC trend snapshot exists, marked with a FreshnessLantern-independent lantern marker and the week's official level.
7. THE Timeline_Chart SHALL expose a text summary adjacent to the chart giving virus, location, date range, the latest `wAvg` with "week of {date}", and the count of gap weeks.
8. WHEN the user focuses a data point by keyboard, THE Timeline_Chart SHALL show a tooltip with "week of {date}", `wAvg`, `histMin` and `histMax`.
9. WHILE the observations request is pending, THE Timeline_Chart SHALL render a chart skeleton.
10. IF no measured weeks exist for the location and virus, THEN THE Timeline_Chart SHALL render "No measured history for {location}" and, for a city with no aggregate, the text "aggregate not published (coverage below PHAC threshold)".
11. IF the observations request fails, THEN THE Timeline_Chart SHALL render an error message with a retry control and leave the other City_Page sections visible.

### Requirement 7: Provenance panel

**User Story:** As a sceptical user, I want to see exactly where every statement comes from, so that I can verify it.

#### Acceptance Criteria

1. WHEN the user opens "Why does it say this?" on a classification, THE Provenance_Panel SHALL show the snapshot ID, the source CSV field name (`Viral_Activity_Level`, `latestLevel`, `latestTrend` or `weekStart`), the evidence-engine rule ID and a link to the source URL.
2. THE Provenance_Panel SHALL state that the classification is published by PHAC (`interpretationMethod: publisher`).
3. THE Provenance_Panel SHALL render snapshot IDs and dates in JetBrains Mono.
4. THE UI SHALL provide a "Why does it say this?" control on every statement row of the City_Page and Omen_Card.
5. THE Provenance_Panel SHALL be operable by keyboard, return focus to its trigger when closed, and close on Escape.

### Requirement 8: Planner

**User Story:** As an event planner, I want a guided flow that explains what the data can say about my date, so that I do not read a measurement as a prediction.

#### Acceptance Criteria

1. THE Planner SHALL present five ordered steps: Where, When, Setting, Who and Confirm.
2. THE Planner SHALL populate the Where step from `/api/locations` and allow selection of a PHAC location or a Gazetteer city.
3. THE Planner SHALL offer Setting as a fixed list of options and SHALL NOT accept free-text event details.
4. WHEN the user chooses a date in the When step, THE Planner SHALL classify it with `classifyTiming` against the injected current date and show the matching rule before the user continues: more than 21 days ahead as "too early to know", 0 to 21 days as "latest observed activity, as of week of {date}, not on your event date", past as "historical observations for that period".
5. WHEN the chosen date is more than 21 days ahead, THE Planner SHALL show the text "It's too early to know what will be circulating on {date}".
6. THE Planner SHALL present the Who step as optional with the labels "older adults", "infants" and "immunocompromised" and a "Skip" control.
7. THE Planner SHALL hold Attendee_Categories only in client memory and SHALL NOT write them to the URL, `localStorage` (unless the user opts in to saving the event), cookies, analytics, logs or any network request.
8. THE Planner SHALL show on the Who step the text "These choices stay on this device and are never shared".
9. WHEN the user confirms, THE Planner SHALL navigate to the Omen_Card with only location identifier, event date and setting in the URL.
10. WHEN the Where step has a city with no coverage, THE Planner SHALL explain the coverage state, offer the labelled provincial aggregate, and allow the user to continue to the prevention checklist.
11. IF the user leaves a required step empty, THEN THE Planner SHALL disable Confirm and name the missing step.
12. THE Planner SHALL support completing all steps by keyboard alone, and SHALL use a Touch_Target of at least 44 px on every control.
13. WHILE `/api/locations` is pending, THE Planner SHALL show a skeleton for the Where step.
14. IF `/api/locations` fails, THEN THE Planner SHALL show an error and a retry control, and SHALL keep earlier entries.

### Requirement 9: Omen Card

**User Story:** As an event planner, I want a card that states what the latest observations can and cannot say about my gathering, so that I can share an honest summary.

#### Acceptance Criteria

1. WHEN the Omen_Card route loads, THE Omen_Card SHALL build the EventCard client-side by calling `buildCard` with data fetched from the Read_API for the requested location, and SHALL NOT call any event-summary endpoint.
2. THE Omen_Card SHALL render the place, event date, setting, creation time, four virus rows, the community-wastewater caveat, the prevention checklist with source link and review date, and evidence links.
3. WHEN timing state is `near`, THE Omen_Card SHALL render for each virus the LevelBadge, TrendGlyph, location, virus name and "as of week of {date}, not conditions on your date".
4. WHEN timing state is `too_early`, THE Omen_Card SHALL render "too early to know" and SHALL NOT render any measured-condition claim for the event date.
5. WHEN timing state is `too_early` or `past`, THE Omen_Card SHALL label any historical context "past observations, not a prediction".
6. THE Omen_Card SHALL display the text "community wastewater, not your chance of getting sick" on every rendering.
7. WHEN coverage is `no_city_site`, THE Omen_Card SHALL render the missing-data state with the labelled provincial aggregate when available, and SHALL still render the prevention checklist.
8. WHEN the user activates "Copy share text", THE Omen_Card SHALL copy the output of `generateShareText` to the clipboard and show a confirmation message.
9. IF clipboard access fails, THEN THE Omen_Card SHALL show the share text in a selectable text area.
10. THE Omen_Card SHALL display the share text it copies, so that what is copied equals what is shown.
11. THE Omen_Card SHALL render the Attendee_Categories only on screen in the creator's browser, and SHALL exclude them from share text, URLs, saved-event exports and logs.
12. THE Omen_Card SHALL pass every user-facing string produced by UI templates through the Wording_Guard in the Test_Suite.
13. WHILE data is loading, THE Omen_Card SHALL render a shimmer placeholder.
14. IF the snapshot is unavailable but a Saved_Event baseline exists, THEN THE Omen_Card SHALL render the baseline-only card labelled with its original snapshot ID and creation time.
15. IF no data exists and no baseline exists, THEN THE Omen_Card SHALL render "No recent data" with the general prevention checklist.
16. THE Omen_Card SHALL present the shared text as a dated snapshot and SHALL NOT call it "live".

### Requirement 10: Saved events and what changed

**User Story:** As a returning user, I want to save my card on this device and see what changed since, so that I can follow updates without an account.

#### Acceptance Criteria

1. THE Omen_Card SHALL offer "Save to this device" as an explicit opt-in action, and SHALL NOT write to `localStorage` before the user activates it.
2. WHEN the user saves, THE UI SHALL store the original `snapshotId`, the factual card contents and the creation time in `localStorage`.
3. WHEN the user saves, THE UI SHALL exclude Attendee_Categories from the stored record unless the user separately ticks "Also keep who is attending on this device".
4. THE UI SHALL provide a delete control for each Saved_Event, and WHEN the user activates it, THE UI SHALL remove that record from `localStorage`.
5. THE UI SHALL provide a "Delete all saved events" control.
6. WHEN a Saved_Event is opened and the current snapshot ID differs from the stored baseline snapshot ID, THE Omen_Card SHALL call `diffCards` and render each entry's status, both observation dates and both snapshot IDs.
7. THE Omen_Card SHALL describe a changed value as "newer observation: {old} → {new}" and SHALL NOT use "increasing" or "decreasing" for a diff of two snapshots unless the entry comes from PHAC's `latestTrend`.
8. WHEN a field is missing or revised in the current snapshot, THE Omen_Card SHALL label it "revised" or "no longer reported" and SHALL NOT present it as a measured change.
9. WHEN the current snapshot ID equals the stored baseline, THE Omen_Card SHALL state that no newer snapshot is available.
10. WHEN all entries are unchanged, THE Omen_Card SHALL state "No change in PHAC's latest classifications since your saved card".
11. IF `localStorage` is unavailable or full, THEN THE UI SHALL show a message that the event could not be saved and keep the card on screen.
12. IF a stored record fails schema validation, THEN THE UI SHALL skip it, show "This saved event could not be read" and offer deletion.

### Requirement 11: Behind the Mask (methods) page

**User Story:** As a sceptical user or journalist, I want to see sources, limits and definitions, so that I can judge the app's claims.

#### Acceptance Criteria

1. THE Methods_Page SHALL list the PHAC dashboard, trend CSV, aggregate CSV, data dictionary, technical notes and protective-measures page as links.
2. THE Methods_Page SHALL render ThreeClocks populated from `/api/data-status` together with the schema version in use and the latest snapshot ID.
3. THE Methods_Page SHALL define NA1 and NA2 with PHAC's meanings as stated in the scientific-integrity rule.
4. THE Methods_Page SHALL explain that PHAC publishes aggregates only at 50% population coverage or more (75% nationally) and that a missing aggregate is a coverage gap, not "not detected".
5. THE Methods_Page SHALL explain the two classifications (activity index and signal level) and that Plague Doctor shows PHAC's values unchanged.
6. THE Methods_Page SHALL list what wastewater cannot establish, including individual infection, case counts, hospitalizations and conditions on a future date.
7. THE Methods_Page SHALL state that Plague Doctor is educational, uses PHAC data, and is not endorsed by PHAC or the Government of Canada.
8. THE Methods_Page SHALL list the freshness convention (21 and 35 days) and label it as Plague Doctor's convention, not PHAC's.
9. THE Methods_Page SHALL list the coverage and discontinued-site facts derived from the current snapshot and SHALL NOT hardcode them.
10. WHILE `/api/data-status` is pending, THE Methods_Page SHALL show a skeleton for the clocks section.
11. IF `/api/data-status` reports an ingestion failure, THEN THE Methods_Page SHALL show the failure detail returned by the API and the last valid snapshot's sample week.

### Requirement 12: Screen states

**User Story:** As a visitor on a slow, partial or broken connection, I want every screen to explain itself, so that I am never left with a blank page or a misleading value.

#### Acceptance Criteria

1. THE UI SHALL implement loading, empty/no data, error/stale and success states for each of the Landing_Page, City_Page (including drawer and Timeline_Chart), Planner, Omen_Card and Methods_Page, following the matrix in BUILD_PLAN §5A.
2. WHILE a screen is in the loading state, THE UI SHALL NOT render values from a previous location or virus as current.
3. WHEN a screen is in the empty state, THE UI SHALL state why data is absent using the unknown reason where one exists.
4. WHEN a screen is in the error state, THE UI SHALL render an error message that names the failing resource and provides a retry control.
5. THE UI SHALL announce state changes to assistive technology through an `aria-live` region.
6. THE UI SHALL render unknown, missing and not-sampled data without green, "Low", "Not detected" or any wording that implies absence of disease.

### Requirement 13: Accessibility and responsiveness

**User Story:** As a user with assistive technology or a phone, I want the app to be fully usable, so that the information is available to me.

#### Acceptance Criteria

1. THE UI SHALL meet WCAG 2.2 AA for contrast, focus visibility, target size and name/role/value on the five routes.
2. THE UI SHALL make every interaction available through the Canada_Map available through the keyboard via the City_List or marker focus.
3. THE UI SHALL provide Touch_Targets of at least 44 by 44 CSS pixels for buttons, chips, list rows, toggles and stepper controls.
4. THE UI SHALL render all five routes at Viewport_390 without horizontal scrolling.
5. WHILE Reduced_Motion is active, THE UI SHALL disable fog drift, card slide transitions and other non-essential animation.
6. THE UI SHALL give each route one `h1`, ordered heading levels, a skip-to-content link and landmark regions.
7. THE UI SHALL give every chart and map a text alternative that states the same facts as the graphic.
8. THE UI SHALL NOT use colour as the only signal for any state.
9. THE UI SHALL set the document language to `en-CA`.

### Requirement 14: Wording safety and scientific integrity in copy

**User Story:** As the project owner, I want all UI text to stay inside the product boundary, so that no screen implies a forecast, a verdict or PHAC endorsement.

#### Acceptance Criteria

1. THE UI SHALL source every user-facing health-related sentence from fixed templates in the repository and SHALL NOT generate free-form health statements.
2. THE UI SHALL accompany each measurement with location, virus, PHAC classification and "week of {date}".
3. THE UI SHALL write "week of {date}" and SHALL NOT write "sampled on {date}".
4. THE UI SHALL NOT display a verdict, probability, forecast, individual risk score, diagnosis or treatment advice.
5. THE Test_Suite SHALL run every template and rendered route text through the Wording_Guard and fail on any banned phrase.
6. THE UI SHALL source prevention items only from the `src/evidence/copy/checklist.ts` module, which carries the PHAC source link and review date.
7. THE UI SHALL compute data age from the sample week in America/Toronto calendar dates via the Evidence_Engine and SHALL NOT use download or ingest time for freshness.
8. THE UI SHALL pass the current date into Evidence_Engine functions from a single injectable clock so tests can fix it.

### Requirement 15: Privacy of attendee categories

**User Story:** As a user with sensitive health considerations, I want my attendee choices to remain on my device, so that they are never exposed.

#### Acceptance Criteria

1. THE UI SHALL NOT include Attendee_Categories in any URL, query string, request body, header, share text, clipboard text, export, analytics event or log line.
2. THE UI SHALL send only read-only GET requests with public parameters (`locationId`, `pathogen`, `from`, `to`, `search`) to the Read_API.
3. THE UI SHALL contain no analytics or third-party tracking script.
4. THE Test_Suite SHALL include a property-based test showing that for any combination of Attendee_Categories, the generated share text, the Omen_Card URL and all captured network requests contain none of the category strings.
5. WHEN the user deletes a Saved_Event, THE UI SHALL remove any Attendee_Categories stored with it.

### Requirement 16: Performance and delivery

**User Story:** As a judge opening the URL on a phone, I want the app to load quickly and not download the full history, so that I can use it immediately.

#### Acceptance Criteria

1. THE Landing_Page SHALL ship at most 200 KB of gzip-compressed JavaScript on first load.
2. THE UI SHALL request history per location and virus and SHALL NOT download the full aggregate history to the browser.
3. THE Landing_Page SHALL achieve a Largest Contentful Paint under 2.5 seconds on a mid-range mobile profile in a Lighthouse run.
4. THE UI SHALL use the Read_API and static normalized JSON and SHALL NOT require a login or database.
5. THE UI SHALL contain no secrets in client bundles.

### Requirement 17: Testing and regression

**User Story:** As a maintainer, I want automated tests that prove the UI follows the rules, so that regressions are caught before the demo.

#### Acceptance Criteria

1. THE Test_Suite SHALL contain component tests for LevelBadge, TrendGlyph, FreshnessLantern, ThreeClocks and the four Screen_States, named with the requirement ID they cover (for example `UI-1`).
2. THE Test_Suite SHALL assert that LevelBadge renders `unknown` as hatched "No data" for every unknown reason and never as low, not detected or green.
3. THE Test_Suite SHALL assert that FreshnessLantern output is independent of activity values for all combinations (property-based test).
4. THE Test_Suite SHALL assert that the Fog_Layer density for `unknown` is never the lowest-density fog and always renders hatching (property-based test).
5. THE Test_Suite SHALL assert that the Timeline_Chart output contains no point after the latest returned `weekStart` and keeps gaps for null `wAvg` (property-based test).
6. THE Test_Suite SHALL contain a Playwright smoke test covering Landing_Page, selecting Toronto, opening the Planner, and reaching the Omen_Card.
7. THE Test_Suite SHALL contain a Playwright test that selects Ottawa and sees the provincial-aggregate notice and no values from another city.
8. THE Test_Suite SHALL run axe against the five routes in the Playwright suite and fail on serious or critical violations.
9. THE Test_Suite SHALL keep all 116 existing tests passing.
10. WHEN the build is verified, THE project SHALL pass `npx tsc --noEmit`, `npx vitest run` and `npm run build`.
11. THE project SHALL update `docs/KIRO_USAGE.md` with this spec's usage and any bug a test caught.

### Requirement 18: Supporting data and engine fixes

**User Story:** As a maintainer, I want the history route and two pre-existing defects fixed, so that the timeline, past cards and data status are honest.

#### Acceptance Criteria

1. THE project SHALL expose `GET /api/history?locationId&pathogen&from&to` returning an `ApiEnvelope<MeasuredWeek[]>` sorted ascending by `weekStart`, with 400 for invalid input, 404 for an unknown location and 200 with an empty array for a known location with no history file.
2. THE city-point data SHALL come from Natural Earth populated places plus cited overrides, and a location without a verified point SHALL have no marker and SHALL NOT receive invented coordinates.
3. THE ingestion code SHALL read the normalized index path from an injectable setting, in the same way as `SNAPSHOT_DIR`, so that tests use a temporary directory.
4. THE Test_Suite SHALL include a test showing that ingestion tests never create or modify files under `data/normalized/`.
5. THE file `data/normalized/index.json` SHALL contain no entries whose `sourceUrl` is on `example.com`, and every real entry SHALL carry the true `rowCount` of its parsed file.
6. WHEN `buildCard` builds a `past` card, THE Evidence_Engine SHALL take the measured `wAvg` and `weekStart` from the `MeasuredWeek` whose `epiYear` and `epiWeek` both match the event date, and SHALL use an `epiWeek`-only match solely for the `histMin` and `histMax` band.
7. THE Test_Suite SHALL include a test over real history files showing that a past card for a date in a given year uses that year's `wAvg`.
