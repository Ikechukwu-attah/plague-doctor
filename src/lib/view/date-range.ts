/**
 * Planner date range (UI-19.12 to 19.14). Pure; "today" always comes from the clock
 * and is a Toronto calendar date. Range is [today, today + 365 days].
 */
import { addDaysIso, toTorontoDateString } from "@/evidence/date-utils";
import { isRealDate } from "@/lib/url-state";

export const PLANNER_MAX_DAYS_AHEAD = 365;

export interface PlannerDateRange {
  min: string;
  max: string;
}

export type PlannerDateCheck =
  | { ok: true }
  | { ok: false; reason: "not_a_date" | "out_of_range" };

/** `today` is a Date or a YYYY-MM-DD string; the range is computed on the Toronto calendar. */
export function plannerDateRange(today: Date | string): PlannerDateRange {
  const min = toTorontoDateString(today);
  return { min, max: addDaysIso(min, PLANNER_MAX_DAYS_AHEAD) };
}

/** ok iff `value` is a real YYYY-MM-DD date (four-digit year) inside the range. */
export function validatePlannerDate(value: string, today: Date | string): PlannerDateCheck {
  if (!isRealDate(value)) return { ok: false, reason: "not_a_date" };
  const { min, max } = plannerDateRange(today);
  return value >= min && value <= max ? { ok: true } : { ok: false, reason: "out_of_range" };
}
