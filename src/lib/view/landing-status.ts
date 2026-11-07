/** Landing freshness and stale-banner derivation (UI-2.9, UI-2.10). Pure: no I/O, no system clock. */
import type { SourceSnapshot, StatusObservation } from "@/evidence/types";
import type { FreshnessLabel } from "@/evidence/card-types";
import { TREND_SOURCE_URL } from "@/evidence/copy/sources";
import { freshnessFor } from "./freshness";

export interface LandingStatus {
  /** Newest sample week (EpiWeek Sunday) among the observations. */
  latestWeek?: string;
  freshness: FreshnessLabel;
  /** A rejected PHAC trend download is newer than the snapshot we are showing. */
  rejectedNewer: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function deriveLandingStatus(input: {
  observations: StatusObservation[];
  snapshots: SourceSnapshot[];
  trendSnapshotId?: string | null;
  today: Date | string;
}): LandingStatus {
  let newest: StatusObservation | undefined;
  for (const o of input.observations) {
    if (!DATE_RE.test(o.weekStart)) continue;
    if (!newest || o.weekStart > newest.weekStart) newest = o;
  }
  const trend = input.snapshots.filter((s) => s.sourceUrl === TREND_SOURCE_URL);
  const valid = trend.filter((s) => s.status === "valid");
  const shown =
    valid.find((s) => s.snapshotId === input.trendSnapshotId) ??
    [...valid].sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))[0];
  const rejectedNewer =
    !!shown &&
    trend.some((s) => s.status === "rejected" && Date.parse(s.fetchedAt) > Date.parse(shown.fetchedAt));
  return {
    ...(newest ? { latestWeek: newest.weekStart } : {}),
    freshness: newest ? freshnessFor(newest, input.today).label : "no_data",
    rejectedNewer,
  };
}

/** Banner applies on a failed refresh with last-good data, a newer rejected file, or an outdated sample week. */
export function staleWeekFor(args: {
  status: LandingStatus;
  loadFailedWithLastGood: boolean;
}): string | undefined {
  const { status } = args;
  if (!status.latestWeek) return undefined;
  return args.loadFailedWithLastGood || status.rejectedNewer || status.freshness === "outdated"
    ? status.latestWeek
    : undefined;
}
