import { explainTiming, type PlannerState, type PlannerStep } from "@/lib/view/planner";
import { settingLabel, stepSummaryWhen, stepSummaryWho } from "@/ui-copy";
import { isStepComplete } from "./step-access";

/**
 * One-line summary for a completed step, or undefined when not complete.
 * The Who summary is only "Specified" or "Skipped"; category names appear on the Confirm step only.
 */
export function stepSummary(s: PlannerState, step: PlannerStep, today: Date): string | undefined {
  if (!isStepComplete(s, step)) return undefined;
  switch (step) {
    case "where":
      return s.where?.label;
    case "when":
      return s.when ? stepSummaryWhen({ date: s.when, days: explainTiming(s.when, today).daysAway }) : undefined;
    case "setting":
      return s.venue && s.kind ? settingLabel(s.venue, s.kind) : undefined;
    case "who":
      return stepSummaryWho({ categories: s.attendees, skipped: s.whoSkipped });
    case "confirm":
      return undefined;
  }
}
