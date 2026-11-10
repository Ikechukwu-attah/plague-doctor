/**
 * Recent PHAC weeks (UI-19.21). Pure view model: the last N calendar EpiWeeks
 * ending at the latest measured week. A week with no row, or a null wAvg, is
 * `missing`. Nothing is interpolated, defaulted to zero, or extended past the
 * latest measured week.
 */
import type { MeasuredWeek } from "@/evidence/types";
import { addDaysIso } from "@/evidence/date-utils";
import { recentWeekMeasured, recentWeekMissing, recentWeeksSummary } from "@/ui-copy/status-explanations";

export const RECENT_WEEKS_COUNT = 12;

export interface RecentWeekEntry {
  weekStart: string;
  status: "measured" | "missing";
  /** Present only when status is "measured". */
  wAvg: number | null;
  label: string;
}

export interface RecentWeeksModel {
  entries: RecentWeekEntry[];
  endWeek: string | null;
  measured: number;
  missing: number;
  summary: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function buildRecentWeeks(weeks: readonly Pick<MeasuredWeek, "weekStart" | "wAvg">[], count = RECENT_WEEKS_COUNT): RecentWeeksModel {
  const byWeek = new Map<string, number | null>();
  for (const w of weeks) {
    if (ISO.test(w.weekStart) && !byWeek.has(w.weekStart)) byWeek.set(w.weekStart, w.wAvg);
  }
  let endWeek: string | null = null;
  for (const [week, v] of byWeek) {
    if (v !== null && (endWeek === null || week > endWeek)) endWeek = week;
  }
  if (endWeek === null) return { entries: [], endWeek: null, measured: 0, missing: 0, summary: "" };

  const entries: RecentWeekEntry[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const weekStart = addDaysIso(endWeek, -7 * i);
    const v = byWeek.get(weekStart) ?? null;
    entries.push(
      v === null
        ? { weekStart, status: "missing", wAvg: null, label: recentWeekMissing({ week: weekStart }) }
        : { weekStart, status: "measured", wAvg: v, label: recentWeekMeasured({ week: weekStart, value: v }) },
    );
  }
  const measured = entries.filter((e) => e.status === "measured").length;
  const missing = entries.length - measured;
  return {
    entries,
    endWeek,
    measured,
    missing,
    summary: recentWeeksSummary({ count, endWeek, measured, missing }),
  };
}
