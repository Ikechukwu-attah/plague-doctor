/**
 * Regional-site resolution (UI-19.8 to UI-19.11, design Property 25).
 * Observations are the committed normalized PHAC snapshot (data/normalized/trend-latest.json,
 * real PHAC bytes); table variants are `synthetic`.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { renderToStaticMarkup } from "react-dom/server";
import { readTrendLatest, resolveLocation, deriveLocations } from "../../src/server/normalized-data";
import {
  REGIONAL_SITE_TABLE,
  resolveRegionalSite,
  type RegionalSiteRow,
} from "../../src/server/geo/regional-sites";
import { GAZETTEER } from "../../src/server/geo/cities";
import { buildCityView } from "../../src/lib/view/city-view";
import { buildLandingRows } from "../../src/lib/view/landing-rows";
import { CityRow } from "../../src/components/landing/CityList";
import { RegionalSiteBadge } from "../../src/components/city/RegionalSiteBadge";
import { checkWording } from "../../src/evidence/wording-guard";
import * as copy from "../../src/ui-copy";
import { textOf } from "./helpers";
import type { StatusResponse } from "../../src/lib/api/schemas";

const obs = readTrendLatest();
const envelope = { snapshotId: obs[0]!.snapshotId, sampleWeek: "2026-10-25", sourceUrl: obs[0]!.sourceUrl };
const TODAY = "2026-11-02";

function statusFor(id: string): StatusResponse {
  const location = resolveLocation(id, obs)!;
  const sourceId = location.regional?.targetLocationId ?? id;
  return { location, coverage: location.coverage, observations: obs.filter((o) => o.locationId === sourceId) };
}

describe("UI-19.8 Property 25: only reviewed table rows resolve to a regional site", () => {
  it("every table row has a non-empty citation", () => {
    for (const r of REGIONAL_SITE_TABLE) expect(r.citation.trim().length).toBeGreaterThan(0);
  });

  it("Vancouver resolves to Metro Vancouver with data-derived plant names", () => {
    const loc = resolveLocation("vancouver", obs)!;
    expect(loc.coverage).toBe("regional_site");
    expect(loc.regional?.targetLocationId).toBe("metro-vancouver");
    const sites = new Set(
      obs.filter((o) => o.grouping === "site" && o.city === "Metro Vancouver").map((o) => o.locationName.replace(/^Vancouver /, "")),
    );
    expect(new Set(loc.regional?.siteNames)).toEqual(sites);
    expect(loc.regional?.siteNames).toContain("Iona Island");
  });

  it("property: a city resolves iff it has a row and its target exists in the snapshot; others stay unchanged", () => {
    const ids = [...GAZETTEER.keys()];
    fc.assert(
      fc.property(
        fc.constantFrom(...ids),
        fc.boolean(), // keep or drop the target's rows from the snapshot
        (id, keepTarget) => {
          const snapshot = keepTarget ? obs : obs.filter((o) => o.locationId !== "metro-vancouver");
          const inTable = REGIONAL_SITE_TABLE.some((r) => r.cityId === id);
          const targetPresent = snapshot.some((o) => o.locationId === "metro-vancouver");
          const loc = resolveLocation(id, snapshot);
          const inPhac = snapshot.some((o) => o.locationId === id);
          if (inPhac) return;
          const expectRegional = inTable && targetPresent;
          expect(loc?.coverage === "regional_site").toBe(expectRegional);
          if (!expectRegional) {
            expect(loc?.coverage).toBe("no_city_site");
            expect(loc?.regional).toBeUndefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("property (synthetic table): rows with an empty citation or a missing target never resolve", () => {
    const row = (over: Partial<RegionalSiteRow>): RegionalSiteRow => ({
      cityId: "vancouver",
      cityName: "Vancouver",
      province: "British Columbia",
      targetLocationId: "metro-vancouver",
      citation: "c",
      ...over,
    });
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), fc.string({ minLength: 1, maxLength: 8 }), (blank, other) => {
        expect(resolveRegionalSite("vancouver", obs, [row({ citation: blank.replace(/\S/g, " ") })])).toBeNull();
        expect(resolveRegionalSite("vancouver", obs, [row({ targetLocationId: `x-${other}` })])).toBeNull();
        expect(resolveRegionalSite("toronto", obs, [row({})])).toBeNull();
        expect(resolveRegionalSite("vancouver", obs, [row({})])).not.toBeNull();
      }),
    );
  });

  it("unmatched Gazetteer cities keep no_city_site, the provincial offer and no foreign values", () => {
    const locs = deriveLocations(obs);
    const noSite = locs.filter((l) => l.coverage === "no_city_site");
    expect(noSite.length).toBeGreaterThan(0);
    for (const l of noSite) {
      expect(l.regional).toBeUndefined();
      expect(statusFor(l.locationId).observations).toEqual([]);
    }
    expect(locs.filter((l) => l.coverage === "regional_site").map((l) => l.locationId)).toEqual(["vancouver"]);
  });
});

describe("UI-19.9 city view", () => {
  it("Vancouver shows Metro Vancouver's PHAC values, labelled as a regional site", () => {
    const status = statusFor("vancouver");
    const view = buildCityView({ status, envelope, showRegional: false, today: TODAY });
    expect(view.coverage).toBe("regional_site");
    expect(view.notice.kind).toBe("none");
    expect(view.regionName).toBe("Metro Vancouver");
    expect(view.regionalSite?.sentence).toMatch(/^Vancouver is covered by PHAC's Metro Vancouver site \(.*Iona Island.*plants\)\.$/);
    const src = obs.find((o) => o.locationId === "metro-vancouver" && o.pathogen === "covid19")!;
    const row = view.rows.find((r) => r.pathogen === "covid19")!;
    expect(row.statement.activityIndex).toBe(src.activityIndex);
  });

  it("badge markup carries the label and an accessible 'i'; dialog body is absent until opened", () => {
    const html = renderToStaticMarkup(<RegionalSiteBadge region="Metro Vancouver" />);
    expect(html).toContain(copy.REGIONAL_SITE_LABEL);
    expect(html).toContain(`aria-label="${copy.REGIONAL_SITE_INFO_OPEN}"`);
    expect(textOf(html)).not.toContain("not the same as the city boundary");
  });

  it("regional copy passes the wording guard", () => {
    const texts = [
      copy.REGIONAL_SITE_LABEL,
      copy.REGIONAL_SITE_INFO_BODY,
      copy.regionalCoverageSentence({ place: "Vancouver", region: "Metro Vancouver", siteNames: ["A", "B", "C"] }),
    ];
    for (const t of texts) expect(checkWording(t).passed, t).toBe(true);
  });
});

describe("UI-19.10 landing rows", () => {
  const locations = deriveLocations(obs);
  const rows = buildLandingRows({ locations, observations: obs, virus: "covid19", today: TODAY, showDiscontinued: true });
  const van = rows.find((r) => r.location.locationId === "vancouver")!;
  const metro = rows.find((r) => r.location.locationId === "metro-vancouver")!;

  it("uses the regional location's values and point, without a second marker", () => {
    expect(van.noSite).toBe(false);
    expect(van.observation?.locationId).toBe("metro-vancouver");
    expect(van.point).toEqual(metro.point);
    expect(van.duplicateMarker).toBe(true);
    expect(metro.duplicateMarker).toBeUndefined();
  });

  it("list row shows 'Regional site' and an 'i' outside the link; other rows are unchanged", () => {
    const html = renderToStaticMarkup(<CityRow row={van} />);
    expect(html).toContain(copy.REGIONAL_SITE_LABEL);
    expect(html).not.toContain(copy.NO_MONITORING_SITE);
    expect(html.indexOf("data-regional-info")).toBeGreaterThan(html.indexOf("</a>"));
    const plain = renderToStaticMarkup(<CityRow row={metro} />);
    expect(plain).not.toContain(copy.REGIONAL_SITE_LABEL);
  });
});
