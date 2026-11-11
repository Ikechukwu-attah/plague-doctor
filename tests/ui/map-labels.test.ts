/**
 * Property 30 (task 17.15, UI-3.6 UI-3.11 UI-19.39) extended by task 19.2 (UI-20.16 UI-20.17):
 * map labels never overlap a marker, a leader line or another label.
 * Real PHAC fixture rows through buildLandingRows and dodgeMarkers; the synthetic cases are labelled as such.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildLandingRows } from "../../src/lib/view/landing-rows";
import type { LandingRow } from "../../src/lib/view/landing-rows";
import { selectMapLabels, labelBox, labelText, leaderBox, markerBox } from "../../src/lib/view/map-labels";
import type { MapLabel, LabelRect } from "../../src/lib/view/map-labels";
import { dodgeMarkers } from "../../src/lib/view/marker-dodge";
import type { DodgedMarker } from "../../src/lib/view/marker-dodge";
import { hasMapData } from "../../src/components/landing/CanadaMap";
import { MAP_H, MAP_W } from "../../src/components/landing/map-geometry";
import type { LocationEntry } from "../../src/evidence/types";
import { loadTrendFixture } from "./helpers";

function allRows(): LandingRow[] {
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
  return buildLandingRows({
    locations: [...seen.values()],
    observations: loadTrendFixture(),
    virus: "covid19",
    today: "2026-11-07",
    showDiscontinued: false,
  });
}

const ROWS = allRows();
const mapSize = (width: number) => ({ width, height: (width * MAP_H) / MAP_W });

function visible(showNoData: boolean): LandingRow[] {
  return ROWS.filter((r) => r.point && !r.duplicateMarker && (showNoData || hasMapData(r)));
}
function markersOf(rows: readonly LandingRow[], width: number): DodgedMarker[] {
  const size = mapSize(width);
  return dodgeMarkers(
    rows.map((r) => ({ id: r.location.locationId, x: (r.point!.x / MAP_W) * size.width, y: (r.point!.y / MAP_H) * size.height })),
    { bounds: size },
  ).markers;
}
function widthOf(id: string, rows: readonly LandingRow[]): number {
  const r = rows.find((x) => x.location.locationId === id)!;
  return labelText(r).length * 7.5 + 52;
}
function boxes(labels: MapLabel[], markers: DodgedMarker[], rows: readonly LandingRow[]) {
  return labels.map((l) => {
    const it = markers.find((i) => i.id === l.id)!;
    return { id: l.id, box: labelBox(l.side, it.x, it.y, widthOf(l.id, rows)) };
  });
}
function overlap(a: LabelRect, b: LabelRect): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}
function assertClean(labels: MapLabel[], markers: DodgedMarker[], rows: readonly LandingRow[], size: { width: number; height: number }) {
  const bs = boxes(labels, markers, rows);
  bs.forEach((l, i) => {
    expect(l.box.x0).toBeGreaterThanOrEqual(0);
    expect(l.box.y0).toBeGreaterThanOrEqual(0);
    expect(l.box.x1).toBeLessThanOrEqual(size.width);
    expect(l.box.y1).toBeLessThanOrEqual(size.height);
    for (const m of markers) {
      if (m.id !== l.id) expect(overlap(l.box, markerBox(m))).toBe(false);
      const lb = leaderBox(m);
      if (lb) expect(overlap(l.box, lb)).toBe(false);
    }
    for (const o of bs.slice(i + 1)) expect(overlap(l.box, o.box)).toBe(false);
  });
}

describe("Property 30: map labels never overlap markers, leader lines or labels (task 17.15, 19.2)", () => {
  for (const showNoData of [false, true]) {
    for (const width of [390, 800, 1024, 1440]) {
      it(`fixture rows at ${width} px, showNoData=${showNoData}: every placed label is clean and deterministic`, () => {
        const rows = visible(showNoData);
        const markers = markersOf(rows, width);
        const size = mapSize(width);
        const labels = selectMapLabels(rows, undefined, size, markers);
        assertClean(labels, markers, rows, size);
        const shuffled = [...rows].reverse();
        const again = selectMapLabels(shuffled, undefined, size, markersOf(shuffled, width));
        expect(again).toEqual(labels);
      });
    }
  }

  it("holds for any map size and selected location", () => {
    const rows = visible(true);
    fc.assert(
      fc.property(fc.integer({ min: 320, max: 1600 }), fc.nat({ max: rows.length - 1 }), (width, k) => {
        const size = mapSize(width);
        const markers = markersOf(rows, width);
        const labels = selectMapLabels(rows, rows[k]!.location.locationId, size, markers);
        assertClean(labels, markers, rows, size);
      }),
      { numRuns: 100 },
    );
  });

  describe("side order and dropping (synthetic geometry on real rows)", () => {
    const row = ROWS.find((r) => r.point && hasMapData(r) && r.observation?.grouping === "city")!;
    const id = row.location.locationId;
    const size = { width: 1000, height: 800 };
    const w = widthOf(id, [row]);
    const marker = (x: number, y: number, name = id, trueX = x, trueY = y): DodgedMarker => ({
      id: name,
      x,
      y,
      trueX,
      trueY,
      displaced: x !== trueX || y !== trueY,
    });
    const own = marker(500, 400);
    // Blockers are plain markers with no row; they only act as obstacles.
    const block = (side: "right" | "left" | "above" | "below"): DodgedMarker => {
      const b = labelBox(side, 500, 400, w);
      return marker((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, `blocker:${side}`);
    };
    const run = (...blocked: Array<"right" | "left" | "above" | "below">) =>
      selectMapLabels([row], undefined, size, [own, ...blocked.map(block)]);

    it("free right gives right", () => expect(run()).toEqual([{ id, side: "right" }]));
    it("blocked right, free left gives left", () => expect(run("right")[0]?.side).toBe("left"));
    it("blocked right and left gives above", () => expect(run("right", "left")[0]?.side).toBe("above"));
    it("blocked right, left, above gives below", () => expect(run("right", "left", "above")[0]?.side).toBe("below"));
    it("blocked on all four sides drops the label", () => expect(run("right", "left", "above", "below")).toEqual([]));
    it("a selected location is dropped too when nothing fits", () => {
      const all = ["right", "left", "above", "below"] as const;
      expect(selectMapLabels([row], id, size, [own, ...all.map(block)])).toEqual([]);
    });
    it("a label that would leave the map box is not placed on that side", () => {
      const edge = marker(size.width - 20, 400);
      expect(selectMapLabels([row], undefined, size, [edge])[0]?.side).toBe("left");
    });
    it("a leader line from another marker blocks the side it crosses (synthetic)", () => {
      // Another marker displaced so its leader line runs through the label's right-hand box.
      const b = labelBox("right", 500, 400, w);
      const y = (b.y0 + b.y1) / 2;
      const other = marker(b.x1 + 60, y, "other:leader", b.x0 + 10, y);
      expect(leaderBox(other)).not.toBeNull();
      expect(selectMapLabels([row], undefined, size, [own, other])[0]?.side).toBe("left");
    });
    it("the label's own leader line also blocks the side it points to (synthetic)", () => {
      // Own marker displaced to the right of its true point... the leader runs left, so right stays free.
      const displaced = marker(500, 400, id, 470, 400);
      expect(selectMapLabels([row], undefined, size, [displaced])[0]?.side).toBe("right");
      // Own marker displaced to the left of its true point: the leader runs right through the right box.
      const other = marker(500, 400, id, 530, 400);
      expect(selectMapLabels([row], undefined, size, [other])[0]?.side).not.toBe("right");
    });
  });
});
