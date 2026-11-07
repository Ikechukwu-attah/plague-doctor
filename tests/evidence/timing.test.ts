import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { classifyTiming } from "../../src/evidence/timing";

const TODAY = "2026-10-31";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("EVD-3: Timing classifier", () => {
  describe("Unit tests", () => {
    it("22 days ahead → too_early", () => {
      expect(classifyTiming(addDays(TODAY, 22), TODAY)).toBe("too_early");
    });
    it("21 days ahead → near", () => {
      expect(classifyTiming(addDays(TODAY, 21), TODAY)).toBe("near");
    });
    it("today itself → near", () => {
      expect(classifyTiming(TODAY, TODAY)).toBe("near");
    });
    it("yesterday → past", () => {
      expect(classifyTiming(addDays(TODAY, -1), TODAY)).toBe("past");
    });
    it("55 days ahead (Halifax Christmas 2026-12-25) → too_early", () => {
      expect(classifyTiming("2026-12-25", TODAY)).toBe("too_early");
    });
    it("7 days ahead (Toronto next-Saturday 2026-11-07) → near", () => {
      expect(classifyTiming("2026-11-07", TODAY)).toBe("near");
    });
  });

  describe("EVD-3 P3: events beyond 21 days are always too_early", () => {
    it("EVD-3 P3: events beyond 21 days are always too_early", () => {
      // Feature: evidence-engine, Property 3
      fc.assert(
        fc.property(fc.integer({ min: 22, max: 365 }), (daysAhead) => {
          return classifyTiming(addDays(TODAY, daysAhead), TODAY) === "too_early";
        }),
        { numRuns: 100 }
      );
    });
  });
});
