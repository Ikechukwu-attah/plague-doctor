/**
 * UI-3.1 UI-3.4 UI-3.5 UI-3.6 UI-3.11 UI-3.12 UI-4.1 UI-4.5 UI-13.2 UI-13.7 (task 15.4)
 * Label rule: selected + PHAC city-level observations, ordered by activityIndex severity then locationId,
 * capped, collision-free. Real PHAC fixture rows; no city names are hardcoded here.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildLandingRows } from "../../src/lib/view/landing-rows";
import type { LandingRow } from "../../src/lib/view/landing-rows";
import { selectMapLabels, MAP_LABEL_CAP } from "../../src/lib/view/map-labels";
import { CanadaMap } from "../../src/components/landing/CanadaMap";
import { MAP_H, MAP_W } from "../../src/components/landing/MapMarker";
import type { LocationEntry } from "../../src/evidence/types";
import { loadTrendFixture } from "./helpers";
const SIZE = { width: 673, height: 573 };
function rows(): LandingRow[] {
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
describe("selectMapLabels (task 15.4)", () => {
  const all = rows();
  it("labels only city-level observations with a point, within the cap", () => {
    const labels = selectMapLabels(all, undefined, SIZE, MAP_W, MAP_H);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThanOrEqual(MAP_LABEL_CAP);
    for (const l of labels) {
      const r = all.find((x) => x.location.locationId === l.id)!;
      expect(r.point).toBeDefined();
      expect(r.observation?.grouping).toBe("city");
    }
  });
  it("is stable under input shuffle", () => {
    const a = selectMapLabels(all, undefined, SIZE, MAP_W, MAP_H);
    const b = selectMapLabels([...all].reverse(), undefined, SIZE, MAP_W, MAP_H);
    expect(b.map((l) => l.id).sort()).toEqual(a.map((l) => l.id).sort());
  });
  it("always includes the selected location, even a site-level one, first", () => {
    const sel = all.find((r) => r.point && r.observation?.grouping === "site");
    if (!sel) return;
    const labels = selectMapLabels(all, sel.location.locationId, SIZE, MAP_W, MAP_H);
    expect(labels[0]?.id).toBe(sel.location.locationId);
  });
  it("gives no label to rows without a point", () => {
    const noPoint = all.map((r) => {
      const { point: _p, ...rest } = r;
      return rest as LandingRow;
    });
    expect(selectMapLabels(noPoint, undefined, SIZE, MAP_W, MAP_H)).toEqual([]);
  });
});
describe("CanadaMap fog (task 15.4)", () => {
  it("renders one fog spot per placed marker; unknown is hatched, never absent", () => {
    const r = rows();
    const html = renderToStaticMarkup(<CanadaMap rows={r} virus="covid19" onOpen={() => {}} />);
    const placed = r.filter((x) => x.point).length;
    expect((html.match(/data-fog="/g) ?? []).length).toBe(placed);
    for (const x of r) {
      if (!x.point) continue;
      const act = x.noSite ? "unknown" : (x.observation?.activityIndex ?? "unknown");
      if (act === "unknown") expect(html).toContain('data-fog="hatch"');
    }
  });
});
