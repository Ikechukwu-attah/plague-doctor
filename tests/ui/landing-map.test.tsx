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
import { clusterMarkers } from "../../src/lib/view/marker-clusters";
import { CanadaMap } from "../../src/components/landing/CanadaMap";
import { MAP_H, MAP_W } from "../../src/components/landing/MapMarker";
import type { LocationEntry } from "../../src/evidence/types";
import { loadTrendFixture } from "./helpers";
const SIZE = { width: 1440, height: Math.round(1440 * 0.851) };
function itemsFor(rs: readonly LandingRow[], size = SIZE) {
  return clusterMarkers(
    rs.filter((r) => r.point).map((r) => ({ id: r.location.locationId, fx: r.point!.x / MAP_W, fy: r.point!.y / MAP_H })),
    size,
  );
}
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
    const labels = selectMapLabels(all, undefined, SIZE, itemsFor(all));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThanOrEqual(MAP_LABEL_CAP);
    for (const l of labels) {
      const r = all.find((x) => x.location.locationId === l.id)!;
      expect(r.point).toBeDefined();
      expect(r.observation?.grouping).toBe("city");
    }
  });
  it("is stable under input shuffle", () => {
    const a = selectMapLabels(all, undefined, SIZE, itemsFor(all));
    const b = selectMapLabels([...all].reverse(), undefined, SIZE, itemsFor([...all].reverse()));
    expect(b.map((l) => l.id).sort()).toEqual(a.map((l) => l.id).sort());
  });
  it("always includes the selected location, even a site-level one, first", () => {
    const items = itemsFor(all);
    const singles = new Set(items.filter((i) => i.kind === "marker").map((i) => i.id));
    const sel = all.find((r) => r.point && r.observation?.grouping === "site" && singles.has(r.location.locationId));
    if (!sel) return;
    const labels = selectMapLabels(all, sel.location.locationId, SIZE, items);
    // The selected label is tried first; it is only absent when no side fits (task 17.15).
    if (labels.some((l) => l.id === sel.location.locationId)) expect(labels[0]?.id).toBe(sel.location.locationId);
  });
  it("gives no label to rows without a point", () => {
    const noPoint = all.map((r) => {
      const { point: _p, ...rest } = r;
      return rest as LandingRow;
    });
    expect(selectMapLabels(noPoint, undefined, SIZE, itemsFor(noPoint))).toEqual([]);
  });
});
describe("CanadaMap fog (task 15.4)", () => {
  it("renders one fog spot per placed marker; unknown is hatched, never absent", () => {
    const r = rows();
    const html = renderToStaticMarkup(<CanadaMap rows={r} virus="covid19" showNoData onOpen={() => {}} />);
    const placed = r.filter((x) => x.point).length;
    expect((html.match(/data-fog="/g) ?? []).length).toBe(placed);
    for (const x of r) {
      if (!x.point) continue;
      const act = x.noSite ? "unknown" : (x.observation?.activityIndex ?? "unknown");
      if (act === "unknown") expect(html).toContain('data-fog="hatch"');
    }
  });
});

describe("UI-19.18/19.19 'Show places without data' (task 17.7)", () => {
  const NO_SITE: LocationEntry = {
    locationId: "synthetic-nowhere",
    locationName: "Synthetic Nowhere",
    city: "Synthetic Nowhere",
    province: "Ontario",
    pruid: "35",
    grouping: "city",
    coverage: "no_city_site",
  };
  const withNoSite = buildLandingRows({
    locations: [
      ...rows().map((r) => r.location),
      NO_SITE,
    ],
    observations: loadTrendFixture(),
    virus: "covid19",
    today: "2026-11-07",
    showDiscontinued: true,
    points: { ...Object.fromEntries(rows().filter((r) => r.point).map((r) => [r.location.locationId, r.point!])), "synthetic-nowhere": { x: 500, y: 425.5 } },
  });
  const unknownIds = withNoSite.filter((r) => r.point && !r.duplicateMarker && (r.noSite || r.badge.kind !== "level")).map((r) => r.location.locationId);
  const markerIds = (html: string) => new Set([...html.matchAll(/data-location-id="([^"]+)"/g)].map((m) => m[1]!));

  it("unknown / no-site markers and fog are absent when off and present when on", () => {
    expect(unknownIds).toContain("synthetic-nowhere");
    const off = renderToStaticMarkup(<CanadaMap rows={withNoSite} virus="covid19" onOpen={() => {}} />);
    const on = renderToStaticMarkup(<CanadaMap rows={withNoSite} virus="covid19" showNoData onOpen={() => {}} />);
    const offIds = markerIds(off);
    const onIds = markerIds(on);
    for (const id of unknownIds) {
      expect(offIds.has(id)).toBe(false);
      expect(onIds.has(id)).toBe(true);
    }
    expect(onIds.size).toBeGreaterThan(offIds.size);
    expect((on.match(/data-fog="/g) ?? []).length).toBeGreaterThan((off.match(/data-fog="/g) ?? []).length);
    expect(off).not.toContain('data-fog="hatch"');
  });

  it("the text alternative counts every row either way", () => {
    const alt = (html: string) => /class="visually-hidden">([^<]*)</.exec(html)?.[1];
    const off = renderToStaticMarkup(<CanadaMap rows={withNoSite} virus="covid19" onOpen={() => {}} />);
    const on = renderToStaticMarkup(<CanadaMap rows={withNoSite} virus="covid19" showNoData onOpen={() => {}} />);
    expect(alt(off)).toBe(alt(on));
  });
});
