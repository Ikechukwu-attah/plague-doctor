/**
 * Timing copy (UI-8.4, UI-8.5, UI-9.3, UI-9.4, UI-14.3).
 * `weekOf` is the ONLY producer of "week of {date}".
 */
import type { TimingState } from "../evidence/card-types";
import { formatDisplayDate } from "../evidence/date-utils";

/** "week of Oct 18, 2026". Input: ISO date (EpiWeek Sunday). */
export function weekOf(isoDate: string): string {
  return `week of ${formatDisplayDate(isoDate)}`;
}

/** "It's too early to know what will be circulating on Dec 21, 2026." */
export function tooEarly(s: { date: string }): string {
  return `It's too early to know what will be circulating on ${formatDisplayDate(s.date)}.`;
}

/** "Observed: week of Oct 18, 2026 — not conditions on your date" */
export function observedStrip(s: { week: string }): string {
  return `Observed: ${weekOf(s.week)} — not conditions on your date`;
}

/** "as of week of Oct 18, 2026, not conditions on your date" */
export function asOfNotOnDate(s: { week: string }): string {
  return `as of ${weekOf(s.week)}, not conditions on your date`;
}

export const TOO_EARLY_SHORT = "Too early to know";

/** Planner explanation, one of three templates (UI-8.4). */
export function timingRule(state: TimingState, s: { latestWeek?: string } = {}): string {
  switch (state) {
    case "too_early":
      return "More than 21 days ahead: too early to know.";
    case "near":
      return s.latestWeek
        ? `Latest observed activity, as of ${weekOf(s.latestWeek)}, not on your event date.`
        : "Latest observed activity, as of the most recent week published, not on your event date.";
    case "past":
      return "Historical observations for that period.";
  }
}
