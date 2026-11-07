import { missingSteps, PLANNER_STEP_ORDER, type PlannerState, type PlannerStep } from "@/lib/view/planner";

/** A step can be entered when every required step before it is complete. */
export function canEnterStep(s: PlannerState, step: PlannerStep): boolean {
  const target = PLANNER_STEP_ORDER.indexOf(step);
  const firstMissing = missingSteps(s)[0];
  if (firstMissing === undefined) return true;
  return target <= PLANNER_STEP_ORDER.indexOf(firstMissing);
}

/** Whether the current step's requirement is met, enabling "Next". */
export function canAdvance(s: PlannerState): boolean {
  switch (s.step) {
    case "where":
      return s.where !== undefined;
    case "when":
      return s.when !== undefined;
    case "setting":
      return s.venue !== undefined && s.kind !== undefined;
    case "who":
      return true;
    case "confirm":
      return false;
  }
}

export function isStepComplete(s: PlannerState, step: PlannerStep): boolean {
  switch (step) {
    case "where":
      return s.where !== undefined;
    case "when":
      return s.when !== undefined;
    case "setting":
      return s.venue !== undefined && s.kind !== undefined;
    case "who":
      return s.whoSkipped || s.attendees.length > 0;
    case "confirm":
      return false;
  }
}
