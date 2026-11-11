/**
 * UI-2.3 UI-3.1 UI-3.6 UI-3.8 UI-3.11 UI-3.12 UI-4.1 UI-4.2 UI-4.5 UI-4.6 UI-13.2 UI-13.7
 * Landing component markup (renderToStaticMarkup) over real PHAC fixture rows.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { readFileSync } from "fs";
import { join } from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { buildLandingRows } from "../../src/lib/view/landing-rows";
import type { LandingRow } from "../../src/lib/view/landing-rows";
import { fogSpec } from "../../src/lib/view/fog";
import { checkWording } from "../../src/evidence/wording-guard";
import type { LocationEntry, Pathogen } from "../../src/evidence/types";
import { CanadaMap, countRows, hasMapData } from "../../src/components/landing/CanadaMap";
import { MapMarker } from "../../src/components/landing/MapMarker";
import { MAP_H, MAP_W, markerPosition } from "../../src/components/landing/map-geometry";
import { FogLayer, driftTiming } from "../../src/components/landing/FogLayer";
import { CityList, CityRow } from "../../src/components/landing/CityList";
import { Legend } from "../../src/components/landing/Legend";
import { StaleBanner } from "../../src/components/landing/StaleBanner";
import { FreshnessFooter } from "../../src/components/landing/FreshnessFooter";
import { DiscontinuedToggle, MapToggle } from "../../src/components/landing/Controls";
import { VirusChips, nextVirus, VIRUS_ORDER } from "../../src/components/landing/VirusChips";
import * as copy from "../../src/ui-copy";
import { loadTrendFixture, pathogenArb, textOf } from "./helpers";

const TODAY = "2026-11-07";

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

/** synthetic Gazetteer-only entry with a real point id (no PHAC rows). */
const SYNTHETIC_NO_SITE: LocationEntry = {
  locationId: "synthetic-nowhere",
  locationName: "Synthetic Nowhere",
  city: "Synthetic Nowhere",
  province: "Synthetic Province",
  pruid: "00",
  grouping: "city",
  coverage: "no_city_site",
};

function rowsFor(virus: Pathogen, showDiscontinued = false): LandingRow[] {
  return buildLandingRows({
    locations: [...realLocations(), SYNTHETIC_NO_SITE],
    observations: loadTrendFixture(),
    virus,
    today: TODAY,
    showDiscontinued,
    points: { "synthetic-nowhere": { x: 500, y: 425.5 } },
  });
}

const real = (virus: Pathogen) =>
  buildLandingRows({
    locations: realLocations(),
    observations: loadTrendFixture(),
    virus,
    today: TODAY,
    showDiscontinued: true,
  });

describe("UI-3.1 UI-3.6 markers", () => {
  it("positions are left = x/w and top = y/h percent, with the row's accessible name", () => {
    const rows = real("fluA").filter((r) => r.point);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows.slice(0, 20)) {
      const html = renderToStaticMarkup(<MapMarker row={r} onOpen={() => {}} />);
      const pos = markerPosition(r.point!);
      expect(pos.left).toBe(`${(r.point!.x / MAP_W) * 100}%`);
      expect(pos.top).toBe(`${(r.point!.y / MAP_H) * 100}%`);
      expect(html).toContain(`left:${pos.left}`);
      expect(html).toContain(`top:${pos.top}`);
      expect(html).toContain(`aria-label="${r.markerLabel.replace(/'/g, "&#x27;").replace(/&/g, "&amp;")}"`.replace("&amp;#x27;", "&#x27;"));
    }
  });

  it("marker without a point renders nothing", () => {
    const r = rowsFor("fluA").find((x) => !x.point);
    if (r) expect(renderToStaticMarkup(<MapMarker row={r} onOpen={() => {}} />)).toBe("");
  });

  it("no-site marker is hatched, names 'no monitoring site' and shows no level word", () => {
    const r = rowsFor("fluA").find((x) => x.noSite)!;
    expect(r.point).toBeDefined();
    const html = renderToStaticMarkup(<MapMarker row={r} onOpen={() => {}} />);
    expect(html).toContain("no monitoring site");
    expect(html).toContain("dotHatch");
    expect(textOf(html)).not.toMatch(/High|Moderate|Low|Not detected/);
  });

  it("levels carry icon + word; selected marker is flagged", () => {
    const r = real("covid19").find((x) => x.point && x.badge.kind === "level")!;
    const html = renderToStaticMarkup(<MapMarker row={r} selected onOpen={() => {}} />);
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("selected");
    expect(textOf(html)).toContain(r.badge.kind === "level" ? r.badge.icon : "");
    expect(textOf(html)).toContain(r.badge.word);
  });
});

describe("UI-3.1 UI-13.7 CanadaMap", () => {
  const rows = rowsFor("fluA");
  const html = renderToStaticMarkup(<CanadaMap rows={rows} virus="fluA" week="2026-10-18" onOpen={() => {}} />);
  it("is a labelled group with a text alternative and skip link, outlines hidden from AT", () => {
    expect(html).toContain('role="group"');
    expect(html).toContain('href="#city-list"');
    expect(html).toContain(copy.SKIP_MAP);
    expect(html).toContain('aria-hidden="true" focusable="false"');
    const text = textOf(html);
    expect(text).toContain(copy.weekOf("2026-10-18"));
    expect(text).toContain(copy.NO_MONITORING_SITE);
  });
  it("orders markers west to east in the DOM", () => {
    const xs = [...html.matchAll(/data-location-id="([^"]+)"/g)].map((m) => m[1]!);
    const byId = new Map(rows.map((r) => [r.location.locationId, r.point?.x ?? -1]));
    const seq = xs.map((id) => byId.get(id)!);
    expect(seq).toEqual([...seq].sort((a, b) => a - b));
    // Places without data or monitoring site are hidden by default (UI-19.18).
    expect(xs.length).toBe(rows.filter((r) => r.point && hasMapData(r)).length);
    const all = renderToStaticMarkup(<CanadaMap rows={rows} virus="fluA" week="2026-10-18" showNoData onOpen={() => {}} />);
    expect([...all.matchAll(/data-location-id="/g)].length).toBe(rows.filter((r) => r.point).length);
  });
  it("counts per level add up to the number of rows", () => {
    const c = countRows(rows);
    const sum = Object.values(c.byActivity).reduce((a, b) => a + b, 0) + c.noSite;
    expect(sum).toBe(c.total);
  });
});

describe("UI-3.4 UI-3.5 UI-3.12 FogLayer", () => {
  it("fog density follows the PHAC activity index; unknown is a hatched ring", () => {
    const rows = rowsFor("covid19").filter((r) => r.point);
    const items = rows.map((r) => ({
      id: r.location.locationId,
      spec: fogSpec(r.noSite ? "unknown" : (r.observation?.activityIndex ?? "unknown")),
      left: 1,
      top: 1,
    }));
    const html = renderToStaticMarkup(<FogLayer items={items} />);
    expect(html).toContain('aria-hidden="true"');
    expect([...html.matchAll(/data-fog="/g)].length).toBe(items.length);
    for (const it of items) {
      expect(html).toContain(`data-fog="${it.spec.kind === "fog" ? it.spec.density : "hatch"}"`);
    }
  });
  it("drift duration is always within 12-20 s", () => {
    fc.assert(
      fc.property(fc.nat(10_000), (i) => {
        const t = driftTiming(i);
        expect(t.duration).toBeGreaterThanOrEqual(12);
        expect(t.duration).toBeLessThanOrEqual(20);
      }),
    );
  });
  it("UI-20.18 CSS: the 340 px list column is gone (replaced by the full-width map, see places-table.test.tsx)", () => {
    const css = readFileSync(join(process.cwd(), "src/components/landing/Landing.module.css"), "utf8");
    expect(css).not.toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+340px/);
  });
  it("CSS: 600 ms ease density transition, drift keyframes and a reduced-motion block", () => {
    const css = readFileSync(join(process.cwd(), "src/components/landing/Landing.module.css"), "utf8");
    expect(css).toContain("var(--fog-density-ease)");
    expect(css).toMatch(/@keyframes drift/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  });
});

describe("UI-4.1 UI-4.2 UI-4.6 CityList", () => {
  it("rows are links to /city/{id} and at least 56 px high", () => {
    const rows = rowsFor("fluA");
    const html = renderToStaticMarkup(<CityList rows={rows} query="" onQuery={() => {}} />);
    for (const r of rows.slice(0, 10)) expect(html).toContain(`href="/city/${r.location.locationId}"`);
    const css = readFileSync(join(process.cwd(), "src/components/landing/Landing.module.css"), "utf8");
    expect(css).toMatch(/\.row\s*{[^}]*min-height:\s*56px/);
    expect(html).toContain('type="search"');
    expect(html).toContain('id="city-list"');
  });
  it("empty search result says 'No matching locations'", () => {
    const html = renderToStaticMarkup(<CityList rows={[]} query="zzz" onQuery={() => {}} />);
    expect(textOf(html)).toContain("No matching locations");
    expect(html).toContain('type="search"');
  });
  it("empty snapshot says 'No locations in this snapshot'", () => {
    const html = renderToStaticMarkup(<CityList rows={[]} query="" onQuery={() => {}} />);
    expect(textOf(html)).toContain(copy.NO_LOCATIONS);
  });
  it("Gazetteer-only row shows 'No monitoring site' and no level word", () => {
    const r = rowsFor("rsv").find((x) => x.noSite)!;
    const text = textOf(renderToStaticMarkup(<CityRow row={r} />));
    expect(text).toContain("No monitoring site");
    expect(text).not.toMatch(/High|Moderate|Low|Not detected|Increasing|Stable|Decreasing/);
  });
  it("stopped rows (only when shown) carry the reason in words", () => {
    const stopped = real("covid19").filter((r) => r.stopped);
    for (const r of stopped.slice(0, 5)) {
      const html = renderToStaticMarkup(<CityRow row={r} />);
      expect(textOf(html)).toContain(r.stoppedText!);
      expect(html).toContain("No data");
    }
    const hidden = rowsFor("covid19", false).filter((r) => r.stopped);
    expect(hidden).toEqual([]);
  });
});

describe("UI-2.3 VirusChips", () => {
  it("renders four toggle buttons in a labelled group with one pressed", () => {
    const html = renderToStaticMarkup(<VirusChips value="fluB" onChange={() => {}} />);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Virus"');
    expect([...html.matchAll(/aria-pressed="true"/g)].length).toBe(1);
    expect(textOf(html)).toBe("COVID-19 Flu A Flu B RSV");
  });
  it("nextVirus wraps and handles Home/End", () => {
    fc.assert(
      fc.property(pathogenArb, (v) => {
        const i = VIRUS_ORDER.indexOf(v);
        expect(nextVirus(v, "ArrowRight")).toBe(VIRUS_ORDER[(i + 1) % 4]);
        expect(nextVirus(v, "ArrowLeft")).toBe(VIRUS_ORDER[(i + 3) % 4]);
        expect(nextVirus(v, "Home")).toBe("covid19");
        expect(nextVirus(v, "End")).toBe("rsv");
        expect(nextVirus(v, "a")).toBeUndefined();
      }),
    );
  });
});

describe("UI-3.8 Legend", () => {
  it("shows all five variants including hatched No data and the fog sentence", () => {
    const html = renderToStaticMarkup(<Legend />);
    const text = textOf(html);
    for (const w of ["High", "Moderate", "Low", "Not detected", "No data"]) expect(text).toContain(w);
    expect(html).toContain('data-activity="unknown"');
    expect(text).toContain(copy.LEGEND_SENTENCE);
  });
});

describe("UI-2.10 StaleBanner, FreshnessFooter, controls", () => {
  it("stale banner names the verified week", () => {
    const text = textOf(renderToStaticMarkup(<StaleBanner week="2026-10-18" />));
    expect(text).toContain("Showing last verified data from week of Oct 18, 2026");
  });
  it("footer shows the three clocks, 'unavailable' when missing", () => {
    const text = textOf(renderToStaticMarkup(<FreshnessFooter clocks={{}} />));
    expect(text).toContain("Sample week");
    expect(text).toContain("unavailable");
  });
  it("discontinued toggle is unchecked by default; map toggle names its action", () => {
    expect(renderToStaticMarkup(<DiscontinuedToggle checked={false} onChange={() => {}} />)).not.toContain("checked");
    expect(textOf(renderToStaticMarkup(<MapToggle mapShown={false} onToggle={() => {}} />))).toBe("Show map");
    expect(textOf(renderToStaticMarkup(<MapToggle mapShown onToggle={() => {}} />))).toBe("Hide map");
  });
});

describe("UI-14 landing copy templates pass the wording guard", () => {
  it("all landing strings are clean and mapTextAlternative carries virus and week", () => {
    const counts = countRows(rowsFor("fluA"));
    const alt = copy.mapTextAlternative({ virus: "fluA", week: "2026-10-18", counts });
    const all = [
      alt,
      copy.mapLabel({ virus: "rsv", week: "2026-10-18" }),
      copy.mapLabel({ virus: "rsv" }),
      copy.LEGEND_SENTENCE,
      copy.browseAsList({ count: 3 }),
      copy.detailsLabel({ place: "Toronto" }),
      copy.SKIP_MAP,
    ];
    for (const t of all) expect(checkWording(t).violations, t).toEqual([]);
    expect(alt).toContain("Flu A");
    expect(alt).toContain("week of Oct 18, 2026");
  });
});
