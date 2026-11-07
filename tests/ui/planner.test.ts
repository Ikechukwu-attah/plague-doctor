import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { classifyTiming } from "@/evidence/timing";
import { calendarDayDiff, toTorontoDateString } from "@/evidence/date-utils";
import {
  PLANNER_STEP_ORDER,
  explainTiming,
  initialPlannerState,
  missingSteps,
  plannerReducer,
  buildCardUrl,
  type PlannerAction,
} from "@/lib/view/planner";
import { timingRule, tooEarly } from "@/ui-copy/timing";
import { ATTENDEE_CATEGORIES, KINDS, VENUES } from "@/ui-copy/planner-options";
import { isoDateArb } from "./helpers";

const venue = fc.constantFrom(...VENUES.map((v) => v.id));
const kind = fc.constantFrom(...KINDS.map((k) => k.id));
const category = fc.constantFrom(...ATTENDEE_CATEGORIES);
const step = fc.constantFrom(...PLANNER_STEP_ORDER);
const slug = fc.stringMatching(/^[a-z0-9-]{1,40}$/);

const action: fc.Arbitrary<PlannerAction> = fc.oneof(
  slug.map((id) => ({ type: "setWhere" as const, where: { locationId: id, label: id } })),
  isoDateArb.map((d) => ({ type: "setWhen" as const, date: d })),
  fc.record({ venue, kind }).map((x) => ({ type: "setSetting" as const, ...x })),
  category.map((c) => ({ type: "toggleAttendee" as const, category: c })),
  fc.constant({ type: "skipWho" as const }),
  step.map((s) => ({ type: "goto" as const, step: s })),
  fc.constant({ type: "next" as const }),
  fc.constant({ type: "back" as const }),
);

describe("Property 12: timing explanation matches the engine (UI-8.4, UI-8.5)", () => {
  it("state, daysAway, rule and headline agree with the engine", () => {
    fc.assert(
      fc.property(isoDateArb, isoDateArb, fc.option(isoDateArb, { nil: undefined }), (date, today, week) => {
        const e = explainTiming(date, today, week);
        expect(e.state).toBe(classifyTiming(date, today));
        expect(e.daysAway).toBe(calendarDayDiff(toTorontoDateString(today), toTorontoDateString(date)));
        expect(e.rule).toBe(timingRule(e.state, week !== undefined ? { latestWeek: week } : {}));
        expect(e.headline !== undefined).toBe(e.state === "too_early");
        if (e.headline) expect(e.headline).toBe(tooEarly({ date }));
      }),
    );
  });
  it("boundaries: 21 days is near, 22 is too early, -1 is past", () => {
    expect(explainTiming("2026-11-21", "2026-10-31").state).toBe("near");
    expect(explainTiming("2026-11-22", "2026-10-31").state).toBe("too_early");
    expect(explainTiming("2026-10-30", "2026-10-31").state).toBe("past");
  });
});

describe("Property 21: planner reducer only confirms complete, valid plans (UI-8.1, UI-8.11)", () => {
  it("step is valid; next/back move by one; missingSteps empty iff where, when, setting set", () => {
    fc.assert(
      fc.property(fc.array(action, { maxLength: 30 }), (acts) => {
        let s = initialPlannerState;
        for (const a of acts) {
          const before = PLANNER_STEP_ORDER.indexOf(s.step);
          s = plannerReducer(s, a);
          const after = PLANNER_STEP_ORDER.indexOf(s.step);
          expect(after).toBeGreaterThanOrEqual(0);
          if (a.type === "next") expect(after).toBe(Math.min(4, before + 1));
          if (a.type === "back") expect(after).toBe(Math.max(0, before - 1));
        }
        const complete = !!s.where && !!s.when && !!s.venue && !!s.kind;
        expect(missingSteps(s).length === 0).toBe(complete);
        const m = missingSteps(s);
        expect(m).toEqual(PLANNER_STEP_ORDER.filter((x) => m.includes(x)));
      }),
    );
  });
  it("attendees are unique and the card URL never carries them", () => {
    fc.assert(
      fc.property(fc.array(action, { maxLength: 30 }), (acts) => {
        const s = acts.reduce(plannerReducer, initialPlannerState);
        expect(new Set(s.attendees).size).toBe(s.attendees.length);
        if (s.where && s.when && s.venue && s.kind) {
          const url = buildCardUrl({
            locationId: s.where.locationId,
            eventDate: s.when,
            venue: s.venue,
            kind: s.kind,
          });
          for (const c of ATTENDEE_CATEGORIES) expect(url).not.toContain(encodeURIComponent(c));
          expect(url).not.toContain("attendee");
        }
      }),
    );
  });
  it("rejects invalid dates and empty places", () => {
    const actions: PlannerAction[] = [
      { type: "setWhen", date: "2026-02-30" },
      { type: "setWhere", where: { locationId: "", label: "" } },
    ];
    const s = actions.reduce(plannerReducer, initialPlannerState);
    expect(missingSteps(s)).toEqual(["where", "when", "setting"]);
  });
});
