import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { lanternModel } from "../../src/lib/view/freshness";
import type { FreshnessLabel } from "../../src/evidence/card-types";
import { activityArb } from "./helpers";

const LABELS: FreshnessLabel[] = ["latest_available", "delayed", "outdated", "no_data"];
const EXPECTED: Record<FreshnessLabel, [string, string]> = {
  latest_available: ["bright", "Latest available"],
  delayed: ["dim", "Delayed"],
  outdated: ["out", "Outdated"],
  no_data: ["none", "No data"],
};

describe("UI-1.7 UI-1.8 UI-17.3 Property 3: lantern depends only on the freshness label", () => {
  it("maps the four labels to the four fixed pairs", () => {
    for (const l of LABELS) {
      const m = lanternModel(l);
      expect([m.brightness, m.text]).toEqual(EXPECTED[l]);
    }
  });

  it("is identical regardless of activity or signal level", () => {
    fc.assert(
      fc.property(fc.constantFrom(...LABELS), activityArb, activityArb, (label, a, s) => {
        void a;
        void s;
        // lanternModel accepts only the label; repeated calls are identical.
        expect(lanternModel(label)).toEqual(lanternModel(label));
        expect(lanternModel.length).toBe(1);
      }),
    );
  });
});
