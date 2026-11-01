# Milestone 1 — paste this into Kiro (Spec mode)

Open this folder in Kiro, choose **Spec**, and paste:

---

Build Milestone 1 of Plague Doctor, a Canadian wastewater respiratory-virus explorer for Kiroween 2026. Treat `docs/BUILD_PLAN.md` (v2.2) as the product requirements and follow every file in `.kiro/steering/`. Create the spec `data-ingestion` (requirements → design → tasks) with requirement IDs prefixed `ING-`.

Scope: ingestion and the read path only — no UI.
1. Scaffold Next.js App Router + TypeScript (strict), Zod, Vitest, fast-check.
2. Fetch PHAC's `wastewater_trend.csv` and `wastewater_aggregate.csv` server-side with conditional GET (ETag/Last-Modified), timeouts and a size limit.
3. Read the actual headers and the data dictionary before mapping. Implement a header-fingerprint schema registry with the Oct-2026 trend schema (`min, max`) and the Dec-2025 trend schema (`t_low, t_high`). Access by header name; reordered known columns OK; unknown/incompatible columns fail closed and keep the last valid snapshot.
4. Store each valid file as an immutable snapshot under `data/snapshots/` keyed by sha256, then build normalized JSON.
5. Map `Viral_Activity_Level` → activityIndex, `latestLevel` → signalLevel, `latestTrend` → trend; NA1/NA2/No Recent Data/missing aggregate → unknown with reason codes (definitions in steering).
6. Expose `/api/locations`, `/api/observations`, `/api/status`, `/api/data-status`, `/api/snapshots`; every response includes snapshotId, sample week and source URL.
7. Property tests 1, 2, 4, 5, 6, 7 from `coding-and-testing.md`, using trimmed real PHAC fixtures.
8. Only after live ingestion passes: a Wayback backfill script for archived `wastewater_trend.csv` captures (mark `origin: "wayback"` + capture timestamp).

Never invent readings, dates, levels or locations. Document every assumption and which fields the files actually contain.

**Acceptance:** typecheck + tests pass; one current PHAC snapshot ingested; Toronto returns its real activity index, trend, week and source; Ottawa returns "no site" with the Ontario aggregate offered; coverage derived from data, not hardcoded.

---

After Kiro finishes: log the session in `docs/KIRO_USAGE.md`, then create hooks via the Kiro UI (see BUILD_PLAN §9).
