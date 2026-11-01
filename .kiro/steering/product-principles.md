---
inclusion: always
---
# Product principles — Plague Doctor

Plague Doctor is an **educational** public-health surveillance and gathering-planning web app for Canada, built for Kiroween 2026 (Costume Contest). Full requirements: `docs/BUILD_PLAN.md` (v2.2). When this file and the plan disagree, the plan wins; flag the conflict.

## What it is
- Turns PHAC National Wastewater Monitoring data (COVID-19, Flu A, Flu B, RSV) into plain-language, **dated** observations.
- Signature feature: a **living gathering card** that states what the latest observations can and cannot say, and says "too early to know" when an event is beyond the data.

## What it is NOT (never build these)
- No diagnosis, symptom checker, triage, treatment advice, individual risk score or infection probability.
- No forecasts or "safe / unsafe" verdicts for any date or event.
- No accounts, no hospital/patient data, no clinic availability scraping.
- No claims of full Canadian coverage.

## Privacy
- Optional attendee categories (older adults, infants, immunocompromised) are processed **client-side only**. They never cross a network boundary, never appear in URLs, share text, exports, analytics or logs.
- Saved events live in `localStorage`, opt-in, with a delete control.

## New-work rule
All code in this repo is new (created after 2026-10-30 09:00 PT). Do not copy code from other projects.
