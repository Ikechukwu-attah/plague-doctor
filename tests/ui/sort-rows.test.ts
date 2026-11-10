import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { sortRows } from "@/lib/view/sort-rows";
import type { LandingRow } from "@/lib/view/landing-rows";
import { levelBadgeModel } from "@/lib/view/level";
import type { Activity } from "@/evidence/types";
import { parseLandingUrl, serializeLandingUrl } from "@/lib/url-state";

const RANK: Record<Activity, number> = { high: 0, moderate: 1, low: 2, not_detected: 3, unknown: 4 };

/** synthetic rows: only the fields the sort reads are meaningful. */
function row(id: string, name: string, activity: Activity, noSite: boolean): LandingRow {
  return {
    location: { locationId: id, locationName: name },
    badge: levelBadgeModel(activity),
    trend: "unknown",
    freshness: "no_data",
    noSite,
    stopped: false,
    markerLabel: name,
  } as unknown as LandingRow;
}

const rowsArb = fc
  .array(
    fc.tuple(
      fc.string({ minLength: 1, maxLength: 8 }),
      fc.constantFrom<Activity>("high", "moderate", "low", "not_detected", "unknown"),
      fc.boolean(),
    ),
    { maxLength: 30 },
  )
  .map((xs) => xs.map(([name, a, noSite], i) => row(`id-${i}`, name, a, noSite)));

const eff = (r: LandingRow) => (r.noSite || r.badge.kind !== "level" ? 4 : RANK[r.badge.activity]);

describe("Property 27: sort order depends only on the PHAC category, then A–Z, stably, unknown last (UI-19.15, UI-19.16, UI-19.17)", () => {
  it("activity sort is by category rank, ties A–Z, unknown last; deterministic and a permutation", () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const out = sortRows(rows, "activity");
        expect(out).toHaveLength(rows.length);
        expect(new Set(out.map((r) => r.location.locationId))).toEqual(new Set(rows.map((r) => r.location.locationId)));
        for (let i = 1; i < out.length; i++) {
          const a = out[i - 1]!;
          const b = out[i]!;
          expect(eff(a)).toBeLessThanOrEqual(eff(b));
          if (eff(a) === eff(b)) {
            expect(a.location.locationName.localeCompare(b.location.locationName)).toBeLessThanOrEqual(0);
          }
        }
        expect(sortRows([...rows].reverse(), "activity").map((r) => r.location.locationId)).toEqual(
          out.map((r) => r.location.locationId),
        );
      }),
    );
  });

  it("A–Z ignores activity and does not mutate input", () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const copy = [...rows];
        const out = sortRows(rows, "az");
        expect(rows).toEqual(copy);
        for (let i = 1; i < out.length; i++) {
          expect(out[i - 1]!.location.locationName.localeCompare(out[i]!.location.locationName)).toBeLessThanOrEqual(0);
        }
      }),
    );
  });
});

describe("sort URL parameter (UI-19.15)", () => {
  it("round-trips, omits the default, and falls back on junk", () => {
    expect(serializeLandingUrl({ virus: "rsv", sort: "activity" })).toBe("virus=rsv&sort=activity");
    expect(serializeLandingUrl({ virus: "rsv" })).toBe("virus=rsv");
    expect(parseLandingUrl("virus=rsv&sort=activity")).toEqual({ virus: "rsv", sort: "activity" });
    expect(parseLandingUrl("sort=az")).toEqual({ virus: "covid19" });
    expect(parseLandingUrl("sort=score")).toEqual({ virus: "covid19" });
    expect(parseLandingUrl("sort=activity&sort=az")).toEqual({ virus: "covid19" });
  });
});
