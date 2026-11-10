/**
 * Planner screen copy (UI-8). Fixed templates; no free text is ever collected.
 */
import { formatDisplayDate } from "../evidence/date-utils";

export const PLANNER_HEADING = "Plan a gathering";
export const PLANNER_INTRO =
  "Tell us about your gathering. We'll show what the latest published observations can and cannot say about it.";
export const PLANNER_STEPS_LABEL = "Planner steps";

export const STEP_HEADINGS = {
  where: "Where is your gathering?",
  when: "When is it?",
  setting: "What kind of gathering?",
  who: "Who may attend? (optional)",
  confirm: "Check your gathering",
} as const;

export const STEP_NAV_LABELS = {
  where: "Where",
  when: "When",
  setting: "Setting",
  who: "Who",
  confirm: "Confirm",
} as const;

export const STEP_DONE = "completed";
export const STEP_CURRENT = "current step";
export const STEP_LOCKED = "not available yet";

export const BACK = "Back";
export const NEXT = "Next";
export const EDIT = "Edit";
export const CREATE_CARD = "Create Omen Card";

export const WHERE_SEARCH_LABEL = "Search places";
export const WHERE_SEARCH_HELP = "Type a city, site or province name.";
export const WHERE_LIST_LABEL = "Places";
export const WHERE_SELECTED = "Selected";
export const WHERE_COVERAGE_CITY = "City classification";
export const WHERE_COVERAGE_SITE_ONLY = "Sites only";
export const WHERE_COVERAGE_PROVINCE = "Provincial aggregate";
export const WHERE_COVERAGE_NATIONAL = "National";

export function whereSelected(s: { place: string }): string {
  return `Selected place: ${s.place}`;
}

export function noCoverageHeading(s: { place: string }): string {
  return `${s.place} has no monitoring site`;
}

export function aggregateAction(s: { region: string }): string {
  return `Use the ${s.region} provincial aggregate`;
}

export const KEEP_PLACE_ACTION = "Keep this place and continue to the checklist";
export const NO_COVERAGE_CHECKLIST_NOTE =
  "Your card for this place will show no observations and will list the PHAC steps for reducing the spread.";

export const WHEN_LABEL = "Date of your gathering";
export const WHEN_HELP = "Choose a calendar date.";
export function whenOutOfRange(s: { min: string; max: string }): string {
  return `Enter a real date from ${formatDisplayDate(s.min)} to ${formatDisplayDate(s.max)}.`;
}
export const TIMING_HEADING = "How timing changes your card";
export const TIMING_TOO_EARLY_ITEM = "More than 21 days away: too early to know. Past observations only, labelled as past.";
export const TIMING_NEAR_ITEM = "0 to 21 days away: latest observed activity, with its sample week.";
export const TIMING_PAST_ITEM = "Past date: what was observed then. Gaps stay gaps.";

export function daysAway(s: { days: number }): string {
  if (s.days === 0) return "Your gathering is today.";
  if (s.days === 1) return "Your gathering is 1 day away.";
  if (s.days === -1) return "Your gathering was 1 day ago.";
  if (s.days > 0) return `Your gathering is ${s.days} days away.`;
  return `Your gathering was ${-s.days} days ago.`;
}

export const SETTING_VENUE_LEGEND = "Setting";
export const SETTING_KIND_LEGEND = "Gathering type";

export const WHO_LEGEND = "Who may attend";
export const WHO_MEMORY_NOTE =
  "These choices are kept in this browser tab only. They are lost when you reload and are never put in links, files or requests.";
export const WHO_CLEAR = "Clear choices";

export const CONFIRM_CAPTION_WHERE = "Where";
export const CONFIRM_CAPTION_WHEN = "When";
export const CONFIRM_CAPTION_SETTING = "Setting";
export const CONFIRM_CAPTION_WHO = "Who may attend (optional)";
export const CONFIRM_WHO_NONE = "Not specified";
export const CONFIRM_WHO_SKIPPED = "Skipped";
export const STEP_SUMMARY_WHO_SPECIFIED = "Specified";

export const LATEST_WEEK_UNAVAILABLE =
  "The latest sample week for this place could not be loaded. Your card will still be built from what is available.";

export function dateLabel(s: { date: string }): string {
  return formatDisplayDate(s.date);
}

/** Stepper one-line summaries for completed steps (design/Planner.dc.html). */
export function stepSummaryWhen(s: { date: string; days: number }): string {
  return `${formatDisplayDate(s.date)} · ${daysAway({ days: s.days })}`;
}

export function stepSummaryWho(s: { categories: readonly string[]; skipped: boolean }): string {
  // Category names are never shown in the stepper; they appear on the Confirm step only.
  if (s.categories.length > 0) return STEP_SUMMARY_WHO_SPECIFIED;
  return s.skipped ? CONFIRM_WHO_SKIPPED : CONFIRM_WHO_NONE;
}
