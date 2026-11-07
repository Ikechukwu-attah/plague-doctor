/**
 * Freshness copy (UI-1.7). Thresholds are Plague Doctor's convention, not PHAC's.
 */
import type { FreshnessLabel } from "../evidence/card-types";

const LABEL: Record<FreshnessLabel, string> = {
  latest_available: "Latest available",
  delayed: "Delayed",
  outdated: "Outdated",
  no_data: "No data",
};

export function freshnessLabel(l: FreshnessLabel): string {
  return LABEL[l];
}

/** Age in whole calendar days, computed by the evidence engine from the sample week. */
export function ageText(s: { days: number }): string {
  return s.days === 1 ? "1 day old" : `${s.days} days old`;
}

export const DELAYED_CAUTION = "Delayed: the latest sample week is older than usual.";

export const OUTDATED_HISTORY_ONLY = "History only: the latest sample week is too old to describe current activity.";

export const FRESHNESS_CONVENTION =
  "Freshness is our convention, not PHAC's: 21 days or fewer is Latest available, 22 to 35 days is Delayed, and more than 35 days or No Recent Data is Outdated.";
