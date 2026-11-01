# Milestone 2 — Evidence engine (paste into Kiro, Spec mode, Autopilot OFF)

---

Build Milestone 2 of Plague Doctor: the evidence engine. Follow `docs/BUILD_PLAN.md` (v2.2, especially §4, §6 freshness, §8 safety) and every file in `.kiro/steering/`. Create a new spec `evidence-engine` with requirement IDs prefixed `EVD-`. Write requirements.md first and STOP for my review; then design.md and STOP; then tasks.md.

Scope — pure, deterministic TypeScript in `src/evidence/`, no I/O, no UI:
1. **Freshness**: classify an observation's age from its `weekStart` (calendar days in America/Toronto vs an injected `today`): ≤21 Latest available · 22–35 Delayed · >35 or No Recent Data Outdated · NA/missing No data. Ingest/fetch time must never affect it.
2. **Coverage resolution**: city_site / site_only / no_city_site (+ PHAC provincial aggregate, labelled as regional) / unknown. Fix the gazetteer so a city name that matches an existing PHAC location (e.g. "Charlottetown" → "City of Charlottetown and Town of Stratford") resolves to that location instead of no_city_site.
3. **Timing state** for an event date vs the latest observation: too_early (>21 days ahead) · near (0–21 days ahead) · past. Too-early cards contain only labelled historical min/max context for the matching EpiWeek (“past observations, not a prediction”) and the general prevention checklist — never current-level statements framed as event conditions.
4. **EventCard builder**: input {locationId, eventDate, setting, attendeeCategories (client-only)} + normalized data + today → card with per-virus statements; every statement carries snapshotId, sourceUrl, weekStart and the rule that produced it. activityIndex always equals PHAC's Viral_Activity_Level.
5. **Share text**: deterministic template from the card; never includes attendee categories or free text; always includes source, “week of {date}” and the no-forecast caveat.
6. **Saved-event diff**: compare a stored baseline card (snapshotId + statements) with a newly built card; report changed / unchanged / newly missing / revised — never treat missing or revised data as a measured increase/decrease.
7. **Wording guard**: a function + test that rejects the banned phrases in `.kiro/steering/wording-safety.md` across all generated copy.
8. **Property tests (fast-check)**: properties 1, 2, 3, 6, 8, 9, 10, 11 from `coding-and-testing.md` that apply to the engine, using real fixtures for any data.
9. **Kiro hooks** in `.kiro/hooks/`: (a) on save in `src/evidence/**` → run `npx vitest run tests/evidence`; (b) on save in `src/**` copy/template files → run the wording-guard test; (c) on change in `src/server/ingest/**` or `fixtures/**` → run the ingestion tests.

Never invent readings, dates, levels or locations. Log the session in `docs/KIRO_USAGE.md`.

**Acceptance:** typecheck + all tests pass; a 6-weeks-out Christmas card for Halifax is `too_early` with only historical context; a next-Saturday Toronto card shows Toronto's real Oct-18 values with “as of week of Oct 18, 2026, not on your date”; an Ottawa card offers the Ontario aggregate labelled regional; share text for a card with attendee categories contains none of them; 3 hooks exist.

---
