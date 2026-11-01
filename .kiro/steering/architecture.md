---
inclusion: always
---
# Architecture

- **Next.js App Router + TypeScript (strict)**, Tailwind + shadcn/ui, Zod, Vitest + fast-check, Playwright + axe.
- **No database.** Each valid source file is stored as an immutable snapshot in `data/snapshots/` keyed by sha256; a build step emits static normalized JSON (one file per location × virus + a small index). Never ship the 63k-row history to the browser.
- **Ingestion** (`scripts/` + `src/server/ingest/`): server-side only, conditional GET (ETag/Last-Modified), timeouts + size limit, header-fingerprint **schema registry** (Dec-2025 trend schema with `t_low,t_high`; Oct-2026 schema with `min,max`). Access values **by header name**: reordered known columns are accepted; unknown/renamed/retyped required columns → reject, keep last valid snapshot, fail loudly. Idempotent.
- **Evidence engine** (`src/evidence/`): pure, deterministic functions, no I/O. All card logic lives here and runs client-side.
- **Routes (read-only):** `/api/locations`, `/api/observations`, `/api/status`, `/api/data-status`, `/api/snapshots`. Every response carries `snapshotId`, sample week and source URL. No event-summary endpoint.
- **Jobs:** GitHub Actions daily cron for ingestion. Kiro hooks are development tools, not production monitors.
- **Security:** validate all input; never fetch user-supplied URLs; no secrets in client bundles.
