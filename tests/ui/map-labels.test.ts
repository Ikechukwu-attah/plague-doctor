/**
 * Property 30 (task 17.15, UI-3.6 UI-3.11 UI-19.1): map labels never overlap a marker, a cluster or another label.
 * Real PHAC fixture rows through buildLandingRows and clusterMarkers; the synthetic cases are labelled as such.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildLandingRows } from "../../src/lib/view/landing-rows";
import type { LandingRow } from "../../src/lib/view/landing-rows";
import { selectMapLabels, labelBox, labelText } from "../../src/lib/view/map-labels";
import type { MapLabel } from "../../src/lib/view/map-labels";
import { clusterMarkers, HIT_SIZE } from "../../src/lib/view/marker-clusters";
import type { MarkerItem } from "../../src/lib/view/marker-clusters";
import { hasMapData } from "../../src/components/landing/CanadaMap";
import { MAP_H, MAP_W } from "../../src/components/landing/MapMarker";
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
const mapSize = (width: number) => ({ width, height: width * 0.851 });
void MAP_H;

function visible(showNoData: boolean): LandingRow[] {
  return ROWS.filter((r) => r.point && !r.duplicateMarker && (showNoData || hasMapData(r)));
}
function itemsOf(rows: readonly LandingRow[], width: number): MarkerItem[] {
  return clusterMarkers(
    rows.map((r) => ({ id: r.location.locationId, fx: r.point!.x / MAP_W, fy: r.point!.y / MAP_H })),
    mapSize(width),
  );
}
function widthOf(id: string, rows: readonly LandingRow[]): number {
  const r = rows.find((x) => x.location.locationId === id)!;
  return labelText(r).length * 7.5 + 52;
}
function boxes(labels: MapLabel[], items: MarkerItem[], rows: readonly LandingRow[]) {
  return labels.map((l) => {
    const it = items.find((i) => i.id === l.id)!;
    return { id: l.id, box: labelBox(l.side, it.x, it.y, widthOf(l.id, rows)) };
  });
}
function overlap(a: { x0: number; y0: number; x1: number; y1: number }, b: typeof a): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}
function assertClean(labels: MapLabel[], items: MarkerItem[], rows: readonly LandingRow[], size: { width: number; height: number }) {
  const bs = boxes(labels, items, rows);
  bs.forEach((l, i) => {
    expect(l.box.x0).toBeGreaterThanOrEqual(0);
    expect(l.box.y0).toBeGreaterThanOrEqual(0);
    expect(l.box.x1).toBeLessThanOrEqual(size.width);
    expect(l.box.y1).toBeLessThanOrEqual(size.height);
    for (const it of items) {
      if (it.id === l.id) continue;
      const h = HIT_SIZE / 2;
      expect(overlap(l.box, { x0: it.x - h, y0: it.y - h, x1: it.x + h, y1: it.y + h })).toBe(false);
    }
    for (const o of bs.slice(i + 1)) expect(overlap(l.box, o.box)).toBe(false);
  });
}

describe("Property 30: map labels never overlap markers, clusters or labels (task 17.15)", () => {
  for (const showNoData of [false, true]) {
    for (const width of [390, 800, 1024, 1440]) {
      it(`fixture rows at ${width} px, showNoData=${showNoData}: every placed label is clean and deterministic`, () => {
        const rows = visible(showNoData);
        const items = itemsOf(rows, width);
        const size = mapSize(width);
        const labels = selectMapLabels(rows, undefined, size, items);
        assertClean(labels, items, rows, size);
        const shuffled = [...rows].reverse();
        const again = selectMapLabels(shuffled, undefined, size, itemsOf(shuffled, width));
        expect(again).toEqual(labels);
        // The trimmed real fixture has only two city-level single markers at 1440 px (the rest cluster or have no level);
        // every one of them must find a free side there.
        if (width === 1440) expect(labels.length).toBeGreaterThanOrEqual(2);
        console.log(`labels survived: width=${width} showNoData=${showNoData} -> ${labels.length}`);
      });
    }
  }

  it("holds for any map size and selected location", () => {
    const rows = visible(true);
    fc.assert(
      fc.property(fc.integer({ min: 320, max: 1600 }), fc.nat({ max: rows.length - 1 }), (width, k) => {
        const size = mapSize(width);
        const items = itemsOf(rows, width);
        const labels = selectMapLabels(rows, rows[k]!.location.locationId, size, items);
        assertClean(labels, items, rows, size);
      }),
      { numRuns: 100 },
    );
  });

  describe("side order and dropping (synthetic geometry on real rows)", () => {
    const row = ROWS.find((r) => r.point && hasMapData(r) && r.observation?.grouping === "city")!;
    const id = row.location.locationId;
    const size = { width: 1000, height: 800 };
    const w = widthOf(id, [row]);
    const item = (x: number, y: number, extra: Partial<MarkerItem> = {}, name = id): MarkerItem => ({
      kind: "marker",
      id: name,
      x,
      y,
      fx: x / size.width,
      fy: y / size.height,
      memberIds: [name],
      ...extra,
    });
    const own = item(500, 400);
    // Blockers are cluster items so they need no row.
    const block = (side: "right" | "left" | "above" | "below"): MarkerItem => {
      const b = labelBox(side, 500, 400, w);
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      return item(cx, cy, { kind: "cluster", memberIds: ["a", "b"] }, `cluster:${side}`);
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
      const edge = item(size.width - 20, 400);
      expect(selectMapLabels([row], undefined, size, [edge])[0]?.side).toBe("left");
    });
  });
});
