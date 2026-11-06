/**
 * Freshness classifier — EVD-1.
 * Classifies how fresh a PHAC wastewater observation is based solely on
 * weekStart age in America/Toronto calendar days.
 * Never reads the clock; today is always injected.
 */
import type { Activity, UnknownReason } from "./types";
import type { FreshnessLabel } from "./card-types";
import { toTorontoDateString, calendarDayDiff } from "./date-utils";

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Classify the freshness of a PHAC observation.
 *
 * Decision ladder (exact order — EVD-1):
 * 1. weekStart absent/null/not YYYY-MM-DD         → "no_data"
 * 2. activityIndex "unknown" + NA1 or NA2 reason  → "no_data"
 * 3. latestTrend === "No Recent Data"             → "outdated"
 * 4. age ≤ 21 → "latest_available"
 *    22–35    → "delayed"
 *    > 35     → "outdated"
 *
 * @param weekStart     The observation's weekStart field (YYYY-MM-DD).
 * @param latestTrend   The raw latestTrend string from PHAC.
 * @param activityIndex The normalized activityIndex.
 * @param unknownReason The reason code when activityIndex is "unknown".
 * @param today         Injected wall-clock date — NEVER call new Date() here.
 */
export function classifyFreshness(
  weekStart: string | null | undefined,
  latestTrend: string | null | undefined,
  activityIndex: Activity,
  unknownReason: UnknownReason | undefined,
  today: Date | string,
): FreshnessLabel {
  // Step 1: invalid weekStart
  if (!weekStart || !YYYY_MM_DD.test(weekStart)) {
    return "no_data";
  }

  // Step 2: NA1 / NA2 — activity is unknown due to site status, not data age
  if (
    activityIndex === "unknown" &&
    (unknownReason === "na1_new_site" || unknownReason === "na2_not_sampling")
  ) {
    return "no_data";
  }

  // Step 3: PHAC explicitly says no recent data
  if (latestTrend === "No Recent Data") {
    return "outdated";
  }

  // Step 4: age-based classification
  const fromDate = toTorontoDateString(weekStart);
  const toDate = toTorontoDateString(today);
  const age = calendarDayDiff(fromDate, toDate);

  if (age <= 21) return "latest_available";
  if (age <= 35) return "delayed";
  return "outdated";
}
