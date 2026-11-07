Design review — APPROVED with these decisions:
- D1 APPROVED: add the read-only GET /api/history route exactly as proposed.
- D2 APPROVED: Natural Earth populated places + cited overrides; no point means no marker, never invent coordinates.
- P1: FIX IT IN SCOPE (don't just work around it): make the index path injectable like SNAPSHOT_DIR so tests use a temp dir, remove the example.com test entries from data/normalized/index.json by re-running `npm run ingest` into a clean index, and fix rowCount: 0 on real entries; add a test that ingestion tests never touch data/normalized/.
- P2 correction: for PAST events the card must use the MeasuredWeek row whose epiYear AND epiWeek match the event date (that year's wAvg); first-match by epiWeek is only acceptable for the histMin/histMax band. Add a test for it with real history.
- All other conflict resolutions (C1–C24) approved as written.
Now write tasks.md and implement everything in one go; finish with tsc, vitest, npm run build, update KIRO_USAGE.md and summarize.
