/**
 * Timing classifier — EVD-3.
 * Classifies whether an event date is too_early, near, or past relative to today.
 * No new Date() inside; today is always injected.
 */
import type { TimingState } from "./card-types";
import { toTorontoDateString, calendarDayDiff } from "./date-utils";

/**
 * diff = calendarDayDiff(today, eventDate) in whole Toronto calendar days.
 * diff > 21 → "too_early" · diff 0–21 → "near" (inclusive) · diff < 0 → "past"
 */
export function classifyTiming(
  eventDate: string,
  today: Date | string,
): TimingState {
  const diff = calendarDayDiff(toTorontoDateString(today), toTorontoDateString(eventDate));
  if (diff > 21) return "too_early";
  if (diff >= 0) return "near";
  return "past";
}
