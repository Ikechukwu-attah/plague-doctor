/**
 * Property 33 (UI-20.21, UI-20.22): header sorting orders by PHAC values only, ties A–Z, stably,
 * with unknown last in BOTH directions, and round-trips through the URL builders.
 * Rows are built from the real PHAC trend fixture (fixtures/trend-oct-2026.real.csv) plus one
 * `synthetic` Gazetteer-only row.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { sortRows } from "@/lib/view/sort-rows";
import {
  DEFAULT_SORT,
  SORT_KEYS,
  SORT_PARAMS,
  nextSort,
  sortFromParam,
  sortToParam,
  type ListSort,
  type SortDir,
  type SortKey,
} from "@/lib/view/sort-spec";
import { buildLandingRows, type LandingRow } from "@/lib/view/landing-rows";
import type { LocationEntry } from "@/evidence/types";
import { parseLandingUrl, serializeLandingUrl } from "@/lib/url-state";
import { loadTrendFixture } from "./helpers";

function realLocations(): LocationEntry[] {
  const seen = new Map<string, LocationEntry>();
  for (const o of loadTrendFixture()) {
    if ((o.grouping !== "city" && o.grouping !== "site") || seen.has(o.locationId)) continue;
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

/** synthetic: a Gazetteer-only place with no PHAC rows. */
const SYNTHETIC_NO_SITE: LocationEntry = {
  locationId: "synthetic-nowhere",
  locationName: "Synthetic Nowhere",
  city: "Synthetic Nowhere",
  province: "Synthetic Province",
  pruid: "00",
  grouping: "city",
  coverage: "no_city_site",
};

const ROWS: LandingRow[] = (["covid19", "fluA", "rsv"] as const).flatMap((virus) =>
  buildLandingRows({
    locations: [...realLocations(), SYNTHETIC_NO_SITE],
    observations: loadTrendFixture(),
    virus,
    today: "2026-11-07",
    showDiscontinued: true,
  }).map((r) => ({ ...r, location: { ...r.location, locationId: `${virus}:${r.location.locationId}` } })),
);

const LEVEL_VALUE: Record<string, number> = { not_detected: 0, low: 1, moderate: 2, high: 3 };
const TREND_VALUE: Record<string, number> = { decreasing: 0, stable: 1, increasing: 2 };
const FRESH_VALUE: Record<string, number> = { latest_available: 0, delayed: 1, outdated: 2 };

/** Independent oracle: the comparable value of a row for a column, or undefined when it has none. */
function oracle(r: LandingRow, key: SortKey): number | string | undefined {
  const levelKnown = !r.noSite && r.badge.kind === "level";
  switch (key) {
    case "name":
      return r.location.locationName;
    case "province":
      return r.location.province;
    case "level":
      return levelKnown && r.badge.kind === "level" ? LEVEL_VALUE[r.badge.activity] : undefined;
    case "trend":
      return levelKnown ? TREND_VALUE[r.trend] : undefined;
    case "week":
      return r.noSite ? undefined : r.weekStart;
    case "freshness":
      return r.noSite ? undefined : FRESH_VALUE[r.freshness];
  }
}

const cmp = (a: number | string, b: number | string) =>
  typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
const byName = (a: LandingRow, b: LandingRow) => a.location.locationName.localeCompare(b.location.locationName);

const sortArb: fc.Arbitrary<ListSort> = fc.record({
  key: fc.constantFrom<SortKey>(...SORT_KEYS),
  dir: fc.constantFrom<SortDir>("asc", "desc"),
});
const subsetArb = fc.shuffledSubarray(ROWS, { minLength: 0, maxLength: ROWS.length });
const ids = (rows: readonly LandingRow[]) => rows.map((r) => r.location.locationId);

describe("fixture sanity", () => {
  it("covers known levels, unknown levels and a no-monitoring-site row", () => {
    expect(ROWS.some((r) => r.badge.kind === "level")).toBe(true);
    expect(ROWS.some((r) => r.badge.kind === "unknown")).toBe(true);
    expect(ROWS.some((r) => r.noSite)).toBe(true);
  });
});

describe("Property 33: header sorting orders by PHAC category then A–Z, stably, unknown last (UI-20.21)", () => {
  it("is a permutation, idempotent, never mutates, and is identical under any input shuffle", () => {
    fc.assert(
      fc.property(subsetArb, sortArb, (rows, sort) => {
        const before = ids(rows);
        const out = sortRows(rows, sort);
        expect(ids(rows)).toEqual(before);
        expect([...ids(out)].sort()).toEqual([...before].sort());
        expect(ids(sortRows(out, sort))).toEqual(ids(out));
        expect(ids(sortRows([...rows].reverse(), sort))).toEqual(ids(out));
      }),
    );
  });

  it("orders known values in the chosen direction, ties A–Z; rows with no value come last in both directions", () => {
    fc.assert(
      fc.property(subsetArb, sortArb, (rows, sort) => {
        const out = sortRows(rows, sort);
        const sign = sort.dir === "desc" ? -1 : 1;
        let sawMissing = false;
        for (let i = 0; i < out.length; i++) {
          const v = oracle(out[i]!, sort.key);
          if (v === undefined) {
            sawMissing = true;
            continue;
          }
          expect(sawMissing, "a row with a value follows a row without one").toBe(false);
          if (i === 0) continue;
          const p = oracle(out[i - 1]!, sort.key);
          if (p === undefined) continue;
          expect(sign * cmp(p, v)).toBeLessThanOrEqual(0);
          if (cmp(p, v) === 0) expect(byName(out[i - 1]!, out[i]!)).toBeLessThanOrEqual(0);
        }
      }),
    );
  });

  it("level: high outranks moderate, low and not detected by the PHAC category alone (highest first when descending)", () => {
    const out = sortRows(ROWS, { key: "level", dir: "desc" });
    const values = out.map((r) => oracle(r, "level")).filter((v): v is number => typeof v === "number");
    expect(values).toEqual([...values].sort((a, b) => b - a));
    const tail = out.slice(values.length);
    expect(tail.every((r) => oracle(r, "level") === undefined)).toBe(true);
    // no monitoring site and no data rows are in the tail, never rendered as low
    expect(out.slice(0, values.length).every((r) => !r.noSite && r.badge.kind === "level")).toBe(true);
    const asc = sortRows(ROWS, { key: "level", dir: "asc" });
    expect(asc.slice(asc.length - tail.length).every((r) => oracle(r, "level") === undefined)).toBe(true);
  });

  it("legacy values keep working: a-z is the default order, activity is level descending", () => {
    expect(sortFromParam("activity")).toEqual({ key: "level", dir: "desc" });
    expect(ids(sortRows(ROWS, DEFAULT_SORT))).toEqual(ids(sortRows(ROWS, { key: "name", dir: "asc" })));
    const az = sortRows(ROWS, DEFAULT_SORT);
    for (let i = 1; i < az.length; i++) expect(byName(az[i - 1]!, az[i]!)).toBeLessThanOrEqual(0);
  });
});

describe("header clicks (UI-20.21)", () => {
  it("a new column starts ascending, the same column toggles", () => {
    expect(nextSort(DEFAULT_SORT, "level")).toEqual({ key: "level", dir: "asc" });
    expect(nextSort({ key: "level", dir: "asc" }, "level")).toEqual({ key: "level", dir: "desc" });
    expect(nextSort({ key: "level", dir: "desc" }, "level")).toEqual({ key: "level", dir: "asc" });
    expect(nextSort(DEFAULT_SORT, "name")).toEqual({ key: "name", dir: "desc" });
    expect(nextSort({ key: "week", dir: "desc" }, "trend")).toEqual({ key: "trend", dir: "asc" });
  });
});

describe("sort URL parameter round-trips (UI-20.22)", () => {
  it("every key and direction survives serialize then parse; the default is never written", () => {
    fc.assert(
      fc.property(sortArb, (sort) => {
        const param = sortToParam(sort);
        const qs = serializeLandingUrl({ virus: "rsv", ...(param ? { sort: param } : {}) });
        const back = sortFromParam(parseLandingUrl(qs).sort);
        expect(back).toEqual(sort);
        expect(qs.includes("sort=")).toBe(param !== undefined);
      }),
    );
    expect(serializeLandingUrl({ virus: "rsv", sort: "level:desc" })).toBe("virus=rsv&sort=level%3Adesc");
    expect(SORT_PARAMS).toHaveLength(SORT_KEYS.length * 2);
  });

  it("reads legacy and junk values strictly", () => {
    expect(parseLandingUrl("virus=rsv&sort=activity")).toEqual({ virus: "rsv", sort: "level:desc" });
    expect(parseLandingUrl("sort=name")).toEqual({ virus: "covid19" });
    expect(parseLandingUrl("sort=az")).toEqual({ virus: "covid19" });
    expect(parseLandingUrl("sort=score")).toEqual({ virus: "covid19" });
    expect(parseLandingUrl("sort=level:up")).toEqual({ virus: "covid19" });
    expect(parseLandingUrl("sort=level&sort=trend")).toEqual({ virus: "covid19" });
    expect(parseLandingUrl("sort=week:desc")).toEqual({ virus: "covid19", sort: "week:desc" });
    expect(serializeLandingUrl({ virus: "rsv" })).toBe("virus=rsv");
  });
});
