---
inclusion: always
---
# Coding and testing

- TypeScript strict; no `any` in `src/evidence` or `src/server`.
- Reference spec requirement IDs in commit messages and test names (e.g. `ING-3`).
- Every evidence-engine or ingestion change ships with tests. Required property-based tests (fast-check), see `docs/BUILD_PLAN.md` §8:
  1. Changing only ingest time never makes an old sample "Latest available".
  2. Missing/NA rows never yield `low` or `not_detected`.
  3. Events beyond the latest observation never contain measured-condition claims for that date.
  4. Re-ingesting the same file is idempotent.
  5. Returned records match the requested pathogen and grouping.
  6. `activityIndex` always equals source `Viral_Activity_Level`.
  7. Known header permutations accepted with identical output; unregistered renames rejected.
  8. Share text never contains attendee categories or free text.
  9. Replay output always carries watermark, capture date, sample week and snapshot ID.
  10. Saved-event diffs never treat missing/revised fields as measured changes.
  11. Attendee categories never cross a network boundary or reach exports/logs.
- Test fixtures must be **real PHAC bytes** (trimmed) with their retrieval date; synthetic fixtures are labelled `synthetic` in the filename.
- When a property test catches a real bug, record it in `docs/KIRO_USAGE.md` (needed for the submission write-up).
