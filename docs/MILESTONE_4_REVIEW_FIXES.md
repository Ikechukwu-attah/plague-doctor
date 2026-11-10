# Milestone 4 — Review fixes and Costume Contest polish

Source: two external reviews of https://plague-doctor.vercel.app (2026-11-07), triaged by the lead.
Kiro: add these as task group 16 to `.kiro/specs/interactive-surveillance-ui/` (requirements, design,
tasks), then implement in order. All existing steering still applies: no forecasts, no invented
numbers, no "safe"/risk claims, all user-facing text through `src/ui-copy/**` and the wording guard,
the injectable clock, and reduced-motion respected.

## P0 — verified bugs (fix first)

### 16.1 Map markers open the wrong city
Verified on the live site with `document.elementFromPoint` at each marker's centre:
Toronto → london, Hamilton → london, Ottawa → montreal, Metro Vancouver → abbotsford,
Vancouver → abbotsford. Markers are 44×44 hit targets and overlap in the Windsor–Québec
corridor and the Lower Mainland.
- Fix: cluster markers whose hit targets overlap at the current map size into one group
  marker ("4 places"). Activating it opens a small chooser listing those places, using the same
  row component as the list, or zooms into an inset. Keep 44 px targets.
- Regression test (Playwright, desktop and 390 px): for every visible marker or cluster,
  `elementFromPoint` at its centre returns that same element.

### 16.2 Omen Card date uses UTC
`CardScreen.tsx:157` builds `createdAt` from `toISOString()`, so in Toronto in the evening the
card says tomorrow. Derive the displayed "Card created" date from the viewer's local calendar date
through the clock module (`useToday`). Test with a fixed clock at 2026-11-07T23:30-05:00 →
"Nov 7, 2026".

### 16.3 404 page has no side padding on phones
Wrap `not-found.tsx` in `PageContainer`. Extend the existing 390 px no-overflow e2e test to `/nope`.

### 16.4 Vancouver shows "No monitoring site" while Metro Vancouver has data
Cities served by a PHAC regional site must resolve to it, explicitly labelled. Example: "Vancouver
is covered by PHAC's Metro Vancouver site (Iona Island, Lions Gate, Lulu Island and Annacis Island
plants)."
- Add a small reviewed table, `city → PHAC location`, only where PHAC's own location name or site
  list covers that city. Cite the source per row, as with the existing approximate overrides. No
  guessing. Anything not in the table keeps the current honest "No monitoring site" plus the
  provincial-aggregate offer.
- The city page and the list row show the regional site's values with a "Regional site" label and
  an "i" that explains catchment versus city boundary.

### 16.5 Planner date accepts six-digit years
Set `min` = today and `max` = today + 365 days (local), both from the clock. Show a validation message
for anything outside that range. Unit test plus e2e.

## P1 — clarity

### 16.6 Sort the city list
Add a sort control: "A–Z" (default) or "Highest activity first" (PHAC activity level, with
unknown/no data/not monitored last and ties A–Z). Sort by PHAC's category only. Don't compute any
new score. Store the choice in the URL.

### 16.7 Bigger map; quieter markers
On desktop the map should use most of the content width, with the list in a narrower column.
Hide "No data" and "No monitoring site" markers on the map by default, behind a toggle "Show places
without data". The list is unchanged.

### 16.8 Explain every status where it's shown
Check that the city page "i" content covers:
- what High, Moderate and Low mean (PHAC's own categories)
- how PHAC defines the trend and over what window
- why cities can have different sample weeks
- the NA1/NA2 and missing-week meanings
- "community signal, not personal chance"

Check that the city page shows the last 8–12 PHAC weeks with missing weeks marked, not
interpolated. If any of this is missing, add it, using only PHAC-sourced definitions already in
`src/evidence/copy/**` and the methods copy.

## P1 — Costume Contest: spooky design that does a job

The judges reward a haunting interface whose design improves function. Keep every honesty rule.

### 16.9 Living fog bound to data
The fog already marks PHAC activity. Make it drift slowly (CSS only, compositor-friendly), with
density and opacity following the PHAC level (higher level, thicker fog). The legend says "Fog
shows PHAC's activity level. It is not your risk." It is static under `prefers-reduced-motion`.

### 16.10 The Omen Card as an omen
Restyle the card as an old omen or tarot card: parchment, ornate border, a wax seal with the bird
glyph, and the level shown as the card's "arcana". Add one fixed line in the plague doctor's voice
per PHAC level, from `src/ui-copy/card.ts` and wording-guarded. The line describes the signal and
never the risk. Example for High: "The waters carry a strong signal this week."
Never say "safe", "danger", "you will" or give percentages. The existing share text is unchanged.

### 16.11 Mask reveal and spooky loading
- Behind the mask: a short mask-lift reveal on first view, about 600 ms. Skip it for reduced motion.
- Loading states: a lantern-and-fog skeleton instead of grey bars, keeping the same reserved
  heights so CLS stays near 0.

### 16.12 Social preview and card image
- Add Open Graph and Twitter meta on all routes, with a static `opengraph-image`: the bird glyph,
  the title and the line "Wastewater signals, not forecasts". It contains no live data, so it can
  never be stale.
- "Download card as image": render the Omen Card to PNG client-side from the same share data
  (SVG to canvas). Don't add a dependency over about 10 KB gzipped and don't use external
  services. If that isn't feasible, skip it and say so.

## Out of scope (explicitly not doing)
- Any personalised risk number, "safe" verdict or forecast. The reviewers agree.
- Defaulting the map to a different virus. COVID-19 stays the default, and the sample week is
  already shown.

## Done means
- tsc clean, vitest all green, Playwright all green, including the new marker-hit and date tests.
- Lighthouse mobile median on `/` stays at perf 90 or above with LCP no worse than 2.5 s. Report
  before and after.
- Screenshots at 1440 and 390 for the landing page (with a cluster open), the Toronto city page,
  the Vancouver city page, the Omen Card and the 404 page.
- KIRO_USAGE.md updated with what was found and fixed. Report anything not done.
