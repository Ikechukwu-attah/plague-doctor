import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildLandingRows } from "@/lib/view/landing-rows";
import type { LocationEntry, StatusObservation } from "@/evidence/types";
import { loadTrendFixture, pathogenArb } from "./helpers";

const TODAY = "2026-11-07";

/** Locations derived from the real trend fixture (no names hardcoded). */
function realLocations(): LocationEntry[] {
  const seen = new Map<string, LocationEntry>();
  for (const o of loadTrendFixture()) {
    if (o.grouping !== "city" && o.grouping !== "site") continue;
    if (seen.has(o.locationId)) continue;
    seen.set(o.locationId, {
      locationId: o.locationId,
      locationName: o.locationName,
      city: o.city,
      province: o.province,
      pruid: o.pruid,
      grouping: o.grouping,
      coverage: o.grouping === "city" ? "city_site" : "site_only",
    });
  }
  return [...seen.values()];
}

/** synthetic Gazetteer-only entries (no PHAC rows). */
const syntheticGazetteer: LocationEntry[] = [
  {
    locationId: "synthetic-nowhere",
    locationName: "Synthetic Nowhere",
    city: "Synthetic Nowhere",
    province: "Synthetic Province",
    pruid: "00",
    grouping: "city",
    coverage: "no_city_site",
  },
  {
    locationId: "synthetic-elsewhere",
    locationName: "Synthetic Elsewhere",
    city: "Synthetic Elsewhere",
    province: "Synthetic Province",
    pruid: "00",
    grouping: "city",
    coverage: "no_city_site",
  },
];

const allLocations = () => [...realLocations(), ...syntheticGazetteer];

describe("Property 5: landing rows carry only their own location's values (UI-2.4, 3.3, 3.6, 4.1, 4.4)", () => {
  it("observation matches row location and virus; missing rows are unknown/no_data", () => {
    const locations = allLocations();
    const observations = loadTrendFixture();
    fc.assert(
      fc.property(pathogenArb, (virus) => {
        const rows = buildLandingRows({ locations, observations, virus, today: TODAY, showDiscontinued: true });
        const ids = new Set(locations.map((l) => l.locationId));
        for (const r of rows) {
          expect(ids.has(r.location.locationId)).toBe(true);
          if (r.observation) {
            expect(r.observation.locationId).toBe(r.location.locationId);
            expect(r.observation.pathogen).toBe(virus);
            expect(r.badge.kind === "unknown" ? "unknown" : r.badge.activity).toBe(r.observation.activityIndex);
            expect(r.markerLabel).toContain(r.location.locationName);
            expect(r.markerLabel).toMatch(/week of /);
          } else {
            expect(r.badge.kind).toBe("unknown");
            expect(r.trend).toBe("unknown");
            expect(r.freshness).toBe("no_data");
          }
          if (r.location.coverage === "no_city_site") {
            expect(r.observation).toBeUndefined();
            expect(r.markerLabel).toContain("no monitoring site");
            expect(r.point).toBeUndefined();
          }
        }
      }),
      { numRuns: 20 },
    );
  });

  it("synthetic Gazetteer-only cities appear as 'No monitoring site' with no other values", () => {
    const rows = buildLandingRows({
      locations: allLocations(),
      observations: loadTrendFixture(),
      virus: "covid19",
      today: TODAY,
      showDiscontinued: false,
    });
    for (const g of syntheticGazetteer) {
      const row = rows.find((r) => r.location.locationId === g.locationId);
      expect(row?.noSite).toBe(true);
      expect(row?.markerLabel).toBe(`${g.locationName}, no monitoring site`);
    }
  });

  it("points come only from the points table", () => {
    const rows = buildLandingRows({
      locations: allLocations(),
      observations: loadTrendFixture(),
      virus: "covid19",
      today: TODAY,
      showDiscontinued: true,
      points: { toronto: { x: 1, y: 2 } },
    });
    for (const r of rows) {
      if (r.point) expect(r.location.locationId).toBe("toronto");
    }
  });

  it("folds site rows under an existing city row", () => {
    const rows = buildLandingRows({
      locations: allLocations(),
      observations: loadTrendFixture(),
      virus: "covid19",
      today: TODAY,
      showDiscontinued: true,
    });
    const cityKeys = new Set(
      rows.filter((r) => r.location.grouping === "city").map((r) => `${r.location.city}|${r.location.province}`),
    );
    for (const r of rows.filter((x) => x.location.grouping === "site")) {
      expect(cityKeys.has(`${r.location.city}|${r.location.province}`)).toBe(false);
    }
  });
});

describe("Property 6: discontinued toggle is a pure, data-derived filter (UI-3.8, 3.9, 3.10)", () => {
  it("on ⊇ off, difference is exactly stopped rows, order-independent, with reasons", () => {
    const locations = allLocations();
    const observations: StatusObservation[] = loadTrendFixture();
    fc.assert(
      fc.property(
        pathogenArb,
        fc.shuffledSubarray(locations, { minLength: locations.length }),
        fc.shuffledSubarray(observations, { minLength: observations.length }),
        (virus, locs, obs) => {
          const run = (showDiscontinued: boolean, l = locs, o = obs) =>
            buildLandingRows({ locations: l, observations: o, virus, today: TODAY, showDiscontinued });
          const on = run(true);
          const off = run(false);
          const onIds = new Set(on.map((r) => r.location.locationId));
          const offIds = new Set(off.map((r) => r.location.locationId));
          for (const id of offIds) expect(onIds.has(id)).toBe(true);
          const diff = on.filter((r) => !offIds.has(r.location.locationId));
          for (const r of diff) {
            expect(
              r.observation?.unknownReason === "na2_not_sampling" || r.observation?.trend === "unknown",
            ).toBe(true);
            expect(r.stoppedText).toBeTruthy();
            expect(r.stoppedText).not.toMatch(/discontinued/i);
          }
          const expected = on.filter((r) => r.stopped).length;
          expect(diff.length).toBe(expected);
          const inputIds = new Set(locations.map((l) => l.locationId));
          for (const id of onIds) expect(inputIds.has(id)).toBe(true);
          // permutation independence
          const canon = run(true, locations, observations).map((r) => r.location.locationId);
          expect(on.map((r) => r.location.locationId)).toEqual(canon);
        },
      ),
      { numRuns: 15 },
    );
  });
});
