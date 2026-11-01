---
inclusion: always
---
# Scientific integrity

## Source of truth
- PHAC files: `wastewater_trend.csv` (latest week, official classifications) and `wastewater_aggregate.csv` (weekly history, measurements only).
- **Read the actual CSV headers and the data dictionary before writing any mapping.** Never assume column positions.

## Classifications — use PHAC's values verbatim
- Headline everywhere = `Viral_Activity_Level` → `activityIndex`. Secondary = `latestLevel` → `signalLevel`. Never mix them in one UI element; never re-classify.
- Trend = PHAC `latestTrend` (5-week method): `Increasing` → increasing, `No Change` → stable, `Decreasing` → decreasing, `No Recent Data` → unknown. We do not compute our own trend in the MVP.
- Historical weeks (aggregate file) have **no** official level. Show measured `w_avg` + PHAC historical `min`/`max` (extremes ever recorded for that EpiWeek — **not** a typical range, confidence interval or forecast).

## Unknowns (PHAC definitions)
- `NA1` → unknown/`na1_new_site`: newly onboarded site, < 12 months of data, awaiting baseline.
- `NA2` → unknown/`na2_not_sampling`: site stopped sampling, has no recent data, or is not being sampled.
- No aggregate row for a city/province → unknown/`aggregate_below_coverage` (PHAC publishes aggregates only at ≥ 50% population coverage; ≥ 75% nationally).
- Missing ≠ zero. Non-detect ≠ no disease. Unknown is **never** rendered as low, not detected, green, or "safe".

## Dates and freshness
- `weekStart` is an EpiWeek Sunday: say "week of {date}", never "sampled on {date}".
- Age maths uses calendar dates in `America/Toronto`, computed from the sample week, never from download/ingest time.
- Freshness labels (our UX convention, not PHAC's): ≤ 21 days Latest available · 22–35 Delayed · > 35 or No Recent Data Outdated · NA/missing No data.

## Geography
- Uncovered city → offer PHAC's own **provincial aggregate**, clearly labelled. Never substitute a neighbouring city's values.
- Never hardcode which cities are covered or discontinued; derive from the current valid snapshot.

## Replay / archives
- Wayback captures are marked `origin: "wayback"` with their capture timestamp. Capture date ≠ sample week. Only values actually present in a captured file may be shown; missing periods stay gaps.
