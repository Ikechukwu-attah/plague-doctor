// UI-19.5 UI-19.6 — "Card created" is the VIEWER's local calendar date, never the UTC date.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createdAt, baselineOnly } from "../../src/ui-copy/card";
import { toLocalIso, localDateParts, createdLocalDate } from "../../src/lib/clock";
import { formatDisplayDate } from "../../src/evidence/date-utils";

const display = (iso: string, tz?: string) => createdAt({ date: createdLocalDate(iso, tz) });

describe("UI-19.6 created date from the viewer's local calendar", () => {
  it("Vancouver viewer at 2026-11-07T22:30-08:00 shows Nov 7, 2026 (not Toronto's Nov 8)", () => {
    const iso = toLocalIso(new Date("2026-11-07T22:30:00-08:00"), "America/Vancouver");
    expect(iso).toBe("2026-11-07T22:30:00-08:00");
    expect(display(iso)).toContain("Nov 7, 2026");
    expect(baselineOnly({ snapshotId: "s", createdAt: iso })).toContain("Nov 7, 2026");
  });

  it("Toronto viewer at 2026-11-07T23:30-05:00 shows Nov 7, 2026", () => {
    const iso = toLocalIso(new Date("2026-11-07T23:30:00-05:00"), "America/Toronto");
    expect(iso).toBe("2026-11-07T23:30:00-05:00");
    expect(display(iso)).toContain("Nov 7, 2026");
  });

  it("legacy Z-stamped createdAt converts via the viewer's zone", () => {
    expect(display("2026-11-08T04:30:00.000Z", "America/Toronto")).toContain("Nov 7, 2026");
    expect(display("2026-11-08T04:30:00.000Z", "Asia/Tokyo")).toContain("Nov 8, 2026");
  });
});

const ZONES = ["America/Vancouver", "America/Toronto", "America/Halifax", "UTC", "Asia/Tokyo"];

describe("UI-19.5 Property 24: created date is the local calendar date for any instant", () => {
  it("P24 holds for any instant and viewer zone", () => {
    // Validates: Requirements 19.5, 19.6
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01T00:00:00Z"), max: new Date("2035-12-31T00:00:00Z"), noInvalidDate: true }),
        fc.constantFrom(...ZONES),
        (d, tz) => {
          const iso = toLocalIso(d, tz);
          const expected = localDateParts(d, tz).date;
          expect(iso.slice(0, 10)).toBe(expected);
          // Same instant (to the second).
          expect(new Date(iso).getTime()).toBe(d.getTime() - (((d.getTime() % 1000) + 1000) % 1000));
          // Valid for the saved-event schema: ISO with an offset.
          expect(iso).toMatch(/[+-]\d{2}:\d{2}$|Z$/);
          expect(display(iso, tz)).toBe(`Card created ${formatDisplayDate(expected)}`);
        },
      ),
      { numRuns: 300 },
    );
  });
});
