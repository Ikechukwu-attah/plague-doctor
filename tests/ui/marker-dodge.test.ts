/**
 * Property 32 (task 19.2, UI-20.9 to UI-20.13): the marker dodge separates 24 px hit boxes deterministically,
 * keeps displacement within the cap and leaves the true points unchanged.
 * Real points: every entry in src/data/geo/city-points.json and the visible fixture rows from buildLandingRows.
 * Generated cases are labelled as such.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import cityPoints from "../../src/data/geo/city-points.json";
import { buildLandingRows } from "../../src/lib/view/landing-rows";
import { dodgeMarkers, hitBoxesOverlap, HIT_MIN, MAX_DISPLACEMENT } from "../../src/lib/view/marker-dodge";
import type { DodgePoint } from "../../src/lib/view/marker-dodge";
import { hasMapData } from "../../src/components/landing/CanadaMap";
import { MAP_H, MAP_W } from "../../src/components/landing/map-geometry";
import type { LocationEntry } from "../../src/evidence/types";
import { loadTrendFixture } from "./helpers";

const size = (width: number) => ({ width, height: (width * MAP_H) / MAP_W });

function realPoints(width: number): DodgePoint[] {
  const s = size(width);
  return Object.entries(cityPoints.entries).map(([id, p]) => ({ id, x: (p.x / MAP_W) * s.width, y: (p.y / MAP_H) * s.height }));
}

function fixtureRowPoints(width: number): DodgePoint[] {
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
  const rows = buildLandingRows({
    locations: [...seen.values()],
    observations: loadTrendFixture(),
    virus: "covid19",
    today: "2026-11-07",
    showDiscontinued: false,
  });
  const s = size(width);
  return rows
    .filter((r) => r.point && !r.duplicateMarker && hasMapData(r))
    .map((r) => ({ id: r.location.locationId, x: (r.point!.x / MAP_W) * s.width, y: (r.point!.y / MAP_H) * s.height }));
}

const overlaps = (m: ReadonlyArray<{ x: number; y: number }>): number => {
  let n = 0;
  for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) if (hitBoxesOverlap(m[i]!, m[j]!, HIT_MIN)) n++;
  return n;
};

function check(points: DodgePoint[], width: number) {
  const s = size(width);
  const out = dodgeMarkers(points, { bounds: s });
  expect(out.markers).toHaveLength(points.length);
  for (const m of out.markers) {
    const t = points.find((p) => p.id === m.id)!;
    expect([m.trueX, m.trueY]).toEqual([t.x, t.y]);
    expect(Math.hypot(m.x - m.trueX, m.y - m.trueY)).toBeLessThanOrEqual(MAX_DISPLACEMENT + 1e-9);
    expect(m.x).toBeGreaterThanOrEqual(0);
    expect(m.x).toBeLessThanOrEqual(s.width);
    expect(m.y).toBeGreaterThanOrEqual(0);
    expect(m.y).toBeLessThanOrEqual(s.height);
  }
  return out;
}

describe("Property 32: marker dodge (real points)", () => {
  for (const [name, pts] of [
    ["all city-points entries", realPoints],
    ["visible fixture rows", fixtureRowPoints],
  ] as const) {
    for (const width of [1440, 1024]) {
      it(`${name} at ${width} px: no two 24 px hit boxes overlap, within the cap, true points unchanged`, () => {
        const out = check(pts(width), width);
        expect(out.unresolved).toEqual([]);
        expect(overlaps(out.markers)).toBe(0);
      });
    }
    it(`${name} at 390 px: best effort, never worse than the undodged layout, deterministic`, () => {
      const points = pts(390);
      const before = overlaps(points);
      const out = check(points, 390);
      expect(overlaps(out.markers)).toBeLessThanOrEqual(before);
      expect(out.unresolved.length).toBe(overlaps(out.markers));
      expect(dodgeMarkers(points, { bounds: size(390) })).toEqual(out);
    });
  }

  it("is invariant under input order and repeats identically (real points)", () => {
    for (const width of [1440, 1024, 390]) {
      const pts = realPoints(width);
      const a = dodgeMarkers(pts, { bounds: size(width) });
      expect(dodgeMarkers([...pts].reverse(), { bounds: size(width) })).toEqual(a);
      expect(dodgeMarkers(pts, { bounds: size(width) })).toEqual(a);
    }
  });

  it("a displaced marker has display and true points that differ; others stay put", () => {
    const out = dodgeMarkers(realPoints(1024), { bounds: size(1024) });
    for (const m of out.markers) {
      const d = Math.hypot(m.x - m.trueX, m.y - m.trueY);
      if (m.displaced) expect(d).toBeGreaterThanOrEqual(2);
      else expect(d).toBeLessThan(2);
    }
  });

  it("two coincident points are separated (synthetic)", () => {
    const out = dodgeMarkers(
      [
        { id: "a", x: 100, y: 100 },
        { id: "b", x: 100, y: 100 },
      ],
      { bounds: { width: 400, height: 300 } },
    );
    expect(out.unresolved).toEqual([]);
    expect(hitBoxesOverlap(out.markers[0]!, out.markers[1]!)).toBe(false);
  });

  it("reports the unresolved pair instead of overlapping silently when the cap is too small (synthetic)", () => {
    const out = dodgeMarkers(
      [
        { id: "a", x: 100, y: 100 },
        { id: "b", x: 100, y: 100 },
      ],
      { maxDisplacement: 2 },
    );
    expect(out.unresolved).toEqual([["a", "b"]]);
    for (const m of out.markers) expect(Math.hypot(m.x - m.trueX, m.y - m.trueY)).toBeLessThanOrEqual(2 + 1e-9);
  });
});

describe("Property 32: marker dodge (generated points, labelled synthetic)", () => {
  // Feature: interactive-surveillance-ui, Property 32
  const sparse = fc
    .uniqueArray(fc.record({ id: fc.stringMatching(/^[a-z]{1,5}$/), x: fc.integer({ min: 0, max: 1000 }), y: fc.integer({ min: 0, max: 600 }) }), {
      selector: (p) => p.id,
      maxLength: 14,
    });
  it("any sparse-enough set: separated, within cap and box, true points kept, order independent", () => {
    fc.assert(
      fc.property(sparse, (pts) => {
        const bounds = { width: 1000, height: 600 };
        const out = dodgeMarkers(pts, { bounds });
        // Up to 14 points: a cluster of that size fits inside the 40 px cap.
        if (out.unresolved.length === 0) expect(overlaps(out.markers)).toBe(0);
        for (const m of out.markers) {
          const t = pts.find((p) => p.id === m.id)!;
          expect([m.trueX, m.trueY]).toEqual([t.x, t.y]);
          expect(Math.hypot(m.x - t.x, m.y - t.y)).toBeLessThanOrEqual(MAX_DISPLACEMENT + 1e-9);
          expect(m.x).toBeGreaterThanOrEqual(0);
          expect(m.x).toBeLessThanOrEqual(bounds.width);
          expect(m.y).toBeGreaterThanOrEqual(0);
          expect(m.y).toBeLessThanOrEqual(bounds.height);
        }
        expect(dodgeMarkers([...pts].reverse(), { bounds })).toEqual(out);
        expect(out.unresolved.length).toBe(overlaps(out.markers));
      }),
      { numRuns: 200 },
    );
  });
  it("points already apart are not moved", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 9 }), fc.integer({ min: 0, max: 9 })), { maxLength: 30 }), (cells) => {
        const uniq = [...new Map(cells.map((c) => [c.join(","), c])).values()];
        const pts = uniq.map(([cx, cy], i) => ({ id: `p${i}`, x: cx * 30, y: cy * 30 }));
        const out = dodgeMarkers(pts);
        for (const m of out.markers) expect(m.displaced).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
