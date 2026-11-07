/**
 * UI-8.1 UI-8.3 UI-8.4 UI-8.5 UI-8.7 UI-13.3 UI-14.5: stepper summaries for completed steps.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ATTENDEE_CATEGORIES } from "../../src/ui-copy/planner-options";
import { checkWording } from "../../src/evidence/wording-guard";
import { stepSummary } from "../../src/components/planner/step-summary";
import { initialPlannerState, type PlannerState } from "../../src/lib/view/planner";

const today = new Date("2026-11-02T15:00:00-05:00");
const full: PlannerState = {
  ...initialPlannerState,
  step: "confirm",
  where: { locationId: "toronto", label: "Toronto, ON" },
  when: "2026-11-09",
  venue: "indoor",
  kind: "family-dinner",
  whoSkipped: false,
  attendees: ["older adults", "infants"],
};

describe("UI-8.1 planner stepper summaries", () => {
  it("shows nothing for incomplete steps", () => {
    for (const step of ["where", "when", "setting", "who", "confirm"] as const) {
      expect(stepSummary(initialPlannerState, step, today)).toBeUndefined();
    }
  });

  it("summarises place, date with days away, and setting", () => {
    expect(stepSummary(full, "where", today)).toBe("Toronto, ON");
    expect(stepSummary(full, "when", today)).toContain("7 days away");
    expect(stepSummary(full, "setting", today)).toBeTruthy();
    expect(stepSummary(full, "confirm", today)).toBeUndefined();
  });

  it("Who summary: only Specified or Skipped, never categories", () => {
    expect(stepSummary(full, "who", today)).toBe("Specified");
    expect(stepSummary({ ...full, attendees: [], whoSkipped: true }, "who", today)).toBe("Skipped");
    expect(stepSummary({ ...full, attendees: [], whoSkipped: false }, "who", today)).toBeUndefined();
  });

  it("no attendee category string appears in any stepper summary", () => {
    const all = (["where", "when", "setting", "who", "confirm"] as const)
      .map((st) => stepSummary(full, st, today) ?? "")
      .join(" ")
      .toLowerCase();
    for (const c of ATTENDEE_CATEGORIES) expect(all).not.toContain(c.toLowerCase());
  });

  it("rail markup built from the summaries contains no attendee category string", () => {
    // The rail renders `<span>{stepSummary}</span>` per step (PlannerStepper); the Who panel is separate.
    const html = renderToStaticMarkup(
      <ol>
        {(["where", "when", "setting", "who", "confirm"] as const).map((st) => (
          <li key={st}>{stepSummary(full, st, today)}</li>
        ))}
      </ol>,
    ).toLowerCase();
    expect(html).toContain("specified");
    for (const c of ATTENDEE_CATEGORIES) expect(html).not.toContain(c.toLowerCase());
  });

  it("summaries pass the wording guard", () => {
    for (const step of ["where", "when", "setting", "who"] as const) {
      const text = stepSummary(full, step, today)!;
      expect(checkWording(text).violations, text).toEqual([]);
    }
  });
});
