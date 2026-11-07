import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { levelBadgeModel } from "../../src/lib/view/level";
import { trendGlyphModel } from "../../src/lib/view/trend";
import { UNKNOWN_REASONS, unknownReason } from "../../src/ui-copy/unknown-reasons";
import { observationArb, activityArb } from "./helpers";
import type { Activity, Direction } from "../../src/evidence/types";

const FIXED: Record<Exclude<Activity, "unknown">, [string, string]> = {
  high: ["▲▲", "High"],
  moderate: ["▲", "Moderate"],
  low: ["▽", "Low"],
  not_detected: ["○", "Not detected"],
};
const TREND: Record<Direction, [string, string]> = {
  increasing: ["↗", "Increasing"],
  stable: ["→", "Stable"],
  decreasing: ["↘", "Decreasing"],
  unknown: ["?", "Unknown"],
};

describe("UI-1.4 UI-1.6 UI-5.2 UI-5.3 Property 1: level and trend are rendered verbatim", () => {
  it("badge follows activityIndex; signal badge follows signalLevel; trend is fixed", () => {
    fc.assert(
      fc.property(observationArb(), (obs) => {
        const head = levelBadgeModel(obs.activityIndex, obs.unknownReason);
        const signal = levelBadgeModel(obs.signalLevel);
        if (obs.activityIndex !== "unknown") {
          expect(head.kind).toBe("level");
          if (head.kind === "level") {
            expect(head.activity).toBe(obs.activityIndex);
            expect([head.icon, head.word]).toEqual(FIXED[obs.activityIndex]);
          }
        }
        if (obs.signalLevel !== "unknown" && signal.kind === "level") {
          expect(signal.activity).toBe(obs.signalLevel);
        }
        const t = trendGlyphModel(obs.trend);
        expect([t.glyph, t.word]).toEqual(TREND[obs.trend]);
      }),
    );
  });
});

describe("UI-1.5 UI-12.6 UI-17.2 Property 2: unknown is never relabelled as a level", () => {
  it("unknown renders hatched 'No data' for every reason and any signal level", () => {
    fc.assert(
      fc.property(fc.constantFrom(...UNKNOWN_REASONS), activityArb, (reason, signal) => {
        const m = levelBadgeModel("unknown", reason);
        expect(m).toEqual({ kind: "unknown", icon: "hatch", word: "No data", reason });
        expect(JSON.stringify(m)).not.toMatch(/level-|green|High|Moderate|Low|Not detected/);
        // signal level must not influence the headline badge
        void signal;
      }),
    );
  });

  it("unknown reason templates are non-empty and contain no level word", () => {
    for (const r of UNKNOWN_REASONS) {
      const text = unknownReason(r);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/\b(high|moderate|low|not detected)\b/i);
    }
  });

  it("omitting the reason still yields the unknown variant", () => {
    expect(levelBadgeModel("unknown")).toEqual({ kind: "unknown", icon: "hatch", word: "No data" });
  });
});
