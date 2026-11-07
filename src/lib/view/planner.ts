/**
 * Planner view model (UI-8.1, 8.3, 8.4, 8.5, 8.7, 8.11). Pure; no I/O.
 * Attendee categories live only in `state.attendees` and never reach `buildCardUrl`.
 */
import type { CoverageStatus, TimingState } from "@/evidence/card-types";
import { calendarDayDiff, toTorontoDateString } from "@/evidence/date-utils";
import { classifyTiming } from "@/evidence/timing";
import { isRealDate } from "@/lib/url-state";
import { timingRule, tooEarly } from "@/ui-copy/timing";
import {
  ATTENDEE_CATEGORIES,
  isKindId,
  isVenueId,
  type AttendeeCategory,
  type KindId,
  type VenueId,
} from "@/ui-copy/planner-options";

export { buildCardUrl } from "@/lib/url-state";

export type PlannerStep = "where" | "when" | "setting" | "who" | "confirm";
export const PLANNER_STEP_ORDER: readonly PlannerStep[] = ["where", "when", "setting", "who", "confirm"];

export interface PlannerState {
  step: PlannerStep;
  where?: { locationId: string; label: string; coverage?: CoverageStatus };
  when?: string;
  venue?: VenueId;
  kind?: KindId;
  whoSkipped: boolean;
  attendees: readonly AttendeeCategory[];
}

export type PlannerAction =
  | { type: "setWhere"; where: NonNullable<PlannerState["where"]> }
  | { type: "setWhen"; date: string }
  | { type: "setSetting"; venue: VenueId; kind: KindId }
  | { type: "toggleAttendee"; category: AttendeeCategory }
  | { type: "skipWho" }
  | { type: "goto"; step: PlannerStep }
  | { type: "next" }
  | { type: "back" };

export const initialPlannerState: PlannerState = {
  step: "where",
  whoSkipped: false,
  attendees: [],
};

function move(step: PlannerStep, delta: 1 | -1): PlannerStep {
  const i = PLANNER_STEP_ORDER.indexOf(step) + delta;
  return PLANNER_STEP_ORDER[Math.min(PLANNER_STEP_ORDER.length - 1, Math.max(0, i))]!;
}

export function plannerReducer(s: PlannerState, a: PlannerAction): PlannerState {
  switch (a.type) {
    case "setWhere":
      return a.where.locationId.length > 0 ? { ...s, where: a.where } : s;
    case "setWhen":
      return isRealDate(a.date) ? { ...s, when: a.date } : s;
    case "setSetting":
      return isVenueId(a.venue) && isKindId(a.kind) ? { ...s, venue: a.venue, kind: a.kind } : s;
    case "toggleAttendee": {
      if (!ATTENDEE_CATEGORIES.includes(a.category)) return s;
      const on = s.attendees.includes(a.category);
      // Canonical order, no duplicates.
      const next = ATTENDEE_CATEGORIES.filter((c) =>
        c === a.category ? !on : s.attendees.includes(c),
      );
      return { ...s, attendees: next };
    }
    case "skipWho":
      return { ...s, whoSkipped: true, attendees: [], step: "confirm" };
    case "goto":
      return PLANNER_STEP_ORDER.includes(a.step) ? { ...s, step: a.step } : s;
    case "next":
      return { ...s, step: move(s.step, 1) };
    case "back":
      return { ...s, step: move(s.step, -1) };
  }
}

/** Required steps still incomplete, in order. "Who" is optional. Confirm is enabled iff empty. */
export function missingSteps(s: PlannerState): PlannerStep[] {
  const out: PlannerStep[] = [];
  if (!s.where) out.push("where");
  if (!s.when) out.push("when");
  if (!s.venue || !s.kind) out.push("setting");
  return out;
}

export interface TimingExplanation {
  state: TimingState;
  daysAway: number;
  rule: string;
  headline?: string;
  latestWeek?: string;
}

export function explainTiming(date: string, today: Date | string, latestWeek?: string): TimingExplanation {
  const state = classifyTiming(date, today);
  const daysAway = calendarDayDiff(toTorontoDateString(today), toTorontoDateString(date));
  const out: TimingExplanation = {
    state,
    daysAway,
    rule: timingRule(state, latestWeek !== undefined ? { latestWeek } : {}),
  };
  if (state === "too_early") out.headline = tooEarly({ date });
  if (latestWeek !== undefined) out.latestWeek = latestWeek;
  return out;
}
