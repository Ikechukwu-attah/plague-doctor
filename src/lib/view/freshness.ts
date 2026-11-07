/** Freshness and lantern view models (UI-1.7, UI-1.8, UI-1.9). */
import type { StatusObservation } from "@/evidence/types";
import type { FreshnessLabel } from "@/evidence/card-types";
import { classifyFreshness } from "@/evidence/freshness";
import { calendarDayDiff, toTorontoDateString } from "@/evidence/date-utils";
import { freshnessLabel } from "@/ui-copy/freshness";

export interface LanternModel {
  brightness: "bright" | "dim" | "out" | "none";
  text: "Latest available" | "Delayed" | "Outdated" | "No data";
}

const BRIGHTNESS: Record<FreshnessLabel, LanternModel["brightness"]> = {
  latest_available: "bright",
  delayed: "dim",
  outdated: "out",
  no_data: "none",
};

/** Input is ONLY the freshness label: lantern brightness never reflects activity. */
export function lanternModel(label: FreshnessLabel): LanternModel {
  return { brightness: BRIGHTNESS[label], text: freshnessLabel(label) as LanternModel["text"] };
}

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Freshness from the sample week and injected today only (America/Toronto
 * calendar days). Uses the same trend mapping as buildCard: an unknown trend
 * is PHAC's "No Recent Data".
 */
export function freshnessFor(
  obs: Pick<StatusObservation, "weekStart" | "trend" | "activityIndex" | "unknownReason">,
  today: Date | string,
): { label: FreshnessLabel; ageDays?: number } {
  const label = classifyFreshness(
    obs.weekStart,
    obs.trend === "unknown" ? "No Recent Data" : "No Change",
    obs.activityIndex,
    obs.unknownReason,
    today,
  );
  if (!obs.weekStart || !YYYY_MM_DD.test(obs.weekStart)) return { label };
  const ageDays = calendarDayDiff(toTorontoDateString(obs.weekStart), toTorontoDateString(today));
  return { label, ageDays };
}
