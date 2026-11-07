/**
 * Coverage and ingestion facts for Behind the Mask (UI-11.9, UI-11.11).
 * Counts only, derived from API data. No place names are written here.
 */
import type { LocationEntry, SourceSnapshot, StatusObservation } from "@/evidence/types";
import { AGGREGATE_SOURCE_URL, TREND_SOURCE_URL } from "@/evidence/copy/sources";
import { toTorontoDateString, formatDisplayDate } from "@/evidence/date-utils";
import { ApiError, describeApiError } from "@/lib/api/errors";
import { weekOf } from "@/ui-copy/timing";

export interface CoverageFactsModel {
  /** Locations present in the current snapshot (PHAC rows), any grouping. */
  locations: number;
  byGrouping: { site: number; city: number; province: number; national: number };
  /** Gazetteer places with no PHAC city or site row (province aggregate may apply). */
  withoutCoverage: number;
  /**
   * Snapshot locations whose every observation is stopped: NA2 or "No Recent Data" (C23).
   * We never claim PHAC discontinued anything.
   */
  discontinued: number;
}

function isStopped(o: StatusObservation): boolean {
  return o.unknownReason === "na2_not_sampling" || o.trend === "unknown";
}

export function buildCoverageFacts(args: {
  locations: readonly LocationEntry[];
  observations: readonly StatusObservation[];
}): CoverageFactsModel {
  const inSnapshot = args.locations.filter((l) => l.coverage !== "no_city_site");
  const byGrouping = { site: 0, city: 0, province: 0, national: 0 };
  for (const l of inSnapshot) byGrouping[l.grouping] += 1;

  const stoppedState = new Map<string, boolean>();
  for (const o of args.observations) {
    const prev = stoppedState.get(o.locationId);
    stoppedState.set(o.locationId, (prev ?? true) && isStopped(o));
  }
  const ids = new Set(inSnapshot.map((l) => l.locationId));
  let discontinued = 0;
  for (const [id, stopped] of stoppedState) if (stopped && ids.has(id)) discontinued += 1;

  return {
    locations: inSnapshot.length,
    byGrouping,
    withoutCoverage: args.locations.length - inSnapshot.length,
    discontinued,
  };
}

export interface IngestionFailureModel {
  /** Detail as reported by the API; no trailing full stop. */
  detail: string;
  /** "week of {date}" for the last valid sample week, if known. */
  lastValidWeek?: string;
}

function latestWeek(weeks: Record<string, string> | undefined): string | undefined {
  if (!weeks) return undefined;
  return Object.values(weeks).sort().pop();
}

function sourceLabel(url: string): string {
  if (url === TREND_SOURCE_URL) return "trend file";
  if (url === AGGREGATE_SOURCE_URL) return "history file";
  return "source file";
}

/**
 * An ingestion failure is shown when (a) the API reports a rejected snapshot fetched after the
 * newest valid one, or (b) the data-status request itself failed. Returns undefined otherwise.
 * The last valid week comes from /api/data-status (current or last good response).
 */
export function buildIngestionFailure(args: {
  dataStatus?: { latestSampleWeekByPathogen: Record<string, string>; lastSuccessfulFetch: string | null };
  dataStatusError?: ApiError;
  snapshots?: readonly SourceSnapshot[];
}): IngestionFailureModel | undefined {
  const week = latestWeek(args.dataStatus?.latestSampleWeekByPathogen);
  const withWeek = (detail: string): IngestionFailureModel =>
    week ? { detail, lastValidWeek: weekOf(week) } : { detail };

  if (args.dataStatusError) {
    const e = args.dataStatusError;
    const base = describeApiError(e).message;
    return withWeek(e.status ? `${base} (HTTP ${e.status})` : base);
  }

  const snaps = args.snapshots ?? [];
  const newestValid = snaps
    .filter((s) => s.status === "valid")
    .reduce<number>((m, s) => Math.max(m, Date.parse(s.fetchedAt) || 0), 0);
  const rejected = snaps
    .filter((s) => s.status === "rejected" && (Date.parse(s.fetchedAt) || 0) > newestValid)
    .sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))[0];
  if (!rejected) return undefined;
  const when = formatDisplayDate(toTorontoDateString(rejected.fetchedAt));
  return withWeek(
    `the ${sourceLabel(rejected.sourceUrl)} fetched on ${when} was rejected (schema ${rejected.schemaVersion}, ${rejected.rejectedRows} rejected rows)`,
  );
}
