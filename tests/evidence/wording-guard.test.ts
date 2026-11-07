import { describe, it, expect } from "vitest";
import { checkWording } from "../../src/evidence/wording-guard";
import { PREVENTION_CHECKLIST } from "../../src/evidence/copy/checklist";

describe("EVD-7: Wording guard", () => {
  describe("passing cases", () => {
    it("empty string passes", () => {
      expect(checkWording("")).toEqual({ passed: true, violations: [] });
    });
    it('"safety instructions" passes (safety not safe)', () => {
      expect(checkWording("safety instructions").passed).toBe(true);
    });
    it('"unpredictable weather" passes', () => {
      expect(checkWording("unpredictable weather").passed).toBe(true);
    });
    it('allowlist: "past observations, not a prediction" passes', () => {
      expect(checkWording("past observations, not a prediction").passed).toBe(true);
    });
    it('allowlist: "not conditions on your date" passes', () => {
      expect(checkWording("not conditions on your date").passed).toBe(true);
    });
    it('allowlist: full too-early phrase passes', () => {
      expect(checkWording("too early to know — not conditions on your date").passed).toBe(true);
    });
    it('allowlist: "not on your event date" passes', () => {
      expect(checkWording("as of week of Oct 18, 2026, not on your event date").passed).toBe(true);
    });
  });

  describe("failing cases", () => {
    it('"Toronto is safe for your dinner" → safe', () => {
      const r = checkWording("Toronto is safe for your dinner");
      expect(r.passed).toBe(false);
      expect(r.violations).toContain("safe");
    });
    it('"forecast for your event next week" → violation', () => {
      const r = checkWording("forecast for your event next week");
      expect(r.passed).toBe(false);
      expect(r.violations).toContain("forecast for your event");
    });
    it('"50% chance of getting sick" → % chance', () => {
      const r = checkWording("50% chance of getting sick");
      expect(r.passed).toBe(false);
      expect(r.violations).toContain("% chance");
    });
    it('"there is a probability of infection" → violation', () => {
      const r = checkWording("there is a probability of infection");
      expect(r.passed).toBe(false);
      expect(r.violations).toContain("probability of infection");
    });
    it('"PHAC endorses this app" → violation', () => {
      const r = checkWording("PHAC endorses this app");
      expect(r.passed).toBe(false);
      expect(r.violations).toContain("PHAC endorses");
    });
    it('"flu will be high next month" → will be high', () => {
      const r = checkWording("flu will be high next month");
      expect(r.passed).toBe(false);
      expect(r.violations).toContain("will be high");
    });
    it("reports multiple distinct violations in one pass", () => {
      const r = checkWording("it is safe and virus-free");
      expect(r.passed).toBe(false);
      expect(r.violations).toContain("safe");
      expect(r.violations).toContain("virus-free");
    });
  });

  describe("EVD-7 + EVD-10: checklist items pass the guard", () => {
    it("all PREVENTION_CHECKLIST items pass", () => {
      for (const item of PREVENTION_CHECKLIST.items) {
        const r = checkWording(item);
        expect(r.passed, `item failed: "${item}" -> ${r.violations.join(", ")}`).toBe(true);
      }
    });
  });
});
