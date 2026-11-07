import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fogSpec } from "@/lib/view/fog";
import { activityArb } from "./helpers";

const ORDER = ["not_detected", "low", "moderate", "high"] as const;

describe("Property 4: fog is monotone in activityIndex alone; unknown is hatched (UI-3.4, 3.5, 3.7)", () => {
  it("known activities are strictly increasing with positive radius/opacity", () => {
    const specs = ORDER.map((a) => fogSpec(a));
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i]!;
      expect(s.kind).toBe("fog");
      if (s.kind !== "fog") continue;
      expect(s.radiusPx).toBeGreaterThan(0);
      expect(s.peakOpacity).toBeGreaterThan(0);
      if (i > 0) {
        const p = specs[i - 1]!;
        if (p.kind === "fog") {
          expect(s.density).toBeGreaterThan(p.density);
          expect(s.radiusPx).toBeGreaterThan(p.radiusPx);
          expect(s.peakOpacity).toBeGreaterThan(p.peakOpacity);
        }
      }
    }
  });

  it("unknown is hatch, never fog; spec is a pure function of the input", () => {
    expect(fogSpec("unknown").kind).toBe("hatch");
    fc.assert(
      fc.property(activityArb, (a) => {
        expect(fogSpec(a)).toEqual(fogSpec(a));
        expect(fogSpec(a).kind === "hatch").toBe(a === "unknown");
      }),
    );
  });
});
