/**
 * City view + provenance tests. Real PHAC fixture rows (trend-oct-2026.real.csv);
 * the no-aggregate case is `synthetic` (aggregate removed from a real response).
 * UI-5.x, UI-7.x; design Properties 10, 11.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildCityView } from "../../src/lib/view/city-view";
import { provenanceFor } from "../../src/lib/view/provenance";
import { resolveLocation } from "../../src/server/normalized-data";
import { TREND_SOURCE_URL } from "../../src/evidence/copy/sources";
import { checkWording } from "../../src/evidence/wording-guard";
import { loadTrendFixture } from "./helpers";
import type { StatusResponse } from "../../src/lib/api/schemas";
import type { NearStatement } from "../../src/evidence/card-types";

const obs = loadTrendFixture();
const TODAY = "2026-10-22";
const envelope = { snapshotId: obs[0]!.snapshotId, sampleWeek: "2026-10-18", sourceUrl: TREND_SOURCE_URL };

function statusFor(locationId: string): StatusResponse {
  const location = resolveLocation(locationId, obs);
  if (!location) throw new Error(`fixture location missing: ${locationId}`);
  const res: StatusResponse = {
    location,
    coverage: location.coverage,
    observations: obs.filter((o) => o.locationId === locationId),
  };
  if (location.coverage === "no_city_site" && location.provinceAggregate) {
    const id = location.provinceAggregate.locationId;
    res.provinceAggregate = { location: location.provinceAggregate, observations: obs.filter((o) => o.locationId === id) };
  }
  return res;
}

describe("UI-5 city view", () => {
  it("UI-5.2 UI-5.3 Toronto rows carry PHAC activityIndex/signalLevel/trend verbatim", () => {
    const status = statusFor("toronto");
    const view = buildCityView({ status, envelope, showRegional: false, today: TODAY });
    expect(view.rows.map((r) => r.pathogen)).toEqual(["covid19", "fluA", "fluB", "rsv"]);
    for (const row of view.rows) {
      const src = status.observations.find((o) => o.pathogen === row.pathogen);
      if (!src) continue;
      expect(row.statement.activityIndex).toBe(src.activityIndex);
      expect(row.statement.signalLevel).toBe(src.signalLevel);
      expect(row.statement.trend).toBe(src.trend);
    }
    expect(view.notice.kind).toBe("none");
    expect(view.snapshotId).toBe(envelope.snapshotId);
  });

  it("UI-5.12 UI-5.13 outdated and delayed flags follow the freshness label", () => {
    const status = statusFor("toronto");
    const delayed = buildCityView({ status, envelope, showRegional: false, today: "2026-11-10" });
    expect(delayed.rows.every((r) => r.delayed && !r.outdated)).toBe(true);
    const outdated = buildCityView({ status, envelope, showRegional: false, today: "2026-12-30" });
    expect(outdated.rows.every((r) => r.outdated && !r.delayed)).toBe(true);
  });

  it("UI-5.5 UI-5.7 Ottawa offers the aggregate without showing any value", () => {
    const view = buildCityView({ status: statusFor("ottawa"), envelope, showRegional: false, today: TODAY });
    expect(view.coverage).toBe("no_city_site");
    expect(view.rows).toEqual([]);
    expect(view.notice).toMatchObject({ kind: "no_city_site", aggregate: "available" });
  });

  it("UI-5.6 Ottawa regional view is labelled with the province, never the city", () => {
    const view = buildCityView({ status: statusFor("ottawa"), envelope, showRegional: true, today: TODAY });
    expect(view.showingRegional).toBe(true);
    expect(view.regionName).toBe("Ontario");
    expect(view.rows).toHaveLength(4);
    for (const r of view.rows) {
      expect(r.statement.regional).toBe(true);
      expect(r.statement.regionLocationName).toBe("Ontario");
    }
    expect(view.notice).toMatchObject({ aggregateLabel: expect.stringContaining("provincial aggregate") });
  });

  it("UI-5.8 `synthetic` no aggregate: not_published, no values, even when regional is requested", () => {
    const status = statusFor("ottawa");
    delete status.provinceAggregate;
    const view = buildCityView({ status, envelope, showRegional: true, today: TODAY });
    expect(view.rows).toEqual([]);
    expect(view.showingRegional).toBe(false);
    expect(view.notice).toMatchObject({ kind: "no_city_site", aggregate: "not_published" });
  });

  it("UI-5.x sites derive from site rows sharing the city", () => {
    const view = buildCityView({ status: statusFor("halifax"), envelope, showRegional: false, today: TODAY, siteObservations: obs });
    expect(view.sites.length).toBeGreaterThan(0);
    expect(view.sites.every((s) => s.locationId !== "halifax")).toBe(true);
  });

  it("Property 10 UI-5.8 UI-9.7: every statement value comes from the requested location or its attached aggregate", () => {
    const ids = ["toronto", "ottawa", "halifax", "moncton", "cape-breton-regional-municipality"];
    fc.assert(
      fc.property(fc.constantFrom(...ids), fc.boolean(), (id, showRegional) => {
        const status = statusFor(id);
        const view = buildCityView({ status, envelope, showRegional, today: TODAY });
        const allowed = new Set([id, status.provinceAggregate?.location.locationId].filter(Boolean));
        for (const r of view.rows) {
          if (r.statement.snapshotId === "") continue; // missing_row placeholder, no value
          const src = obs.find(
            (o) => o.pathogen === r.pathogen && o.snapshotId === r.statement.snapshotId && o.weekStart === r.statement.weekStart && allowed.has(o.locationId),
          );
          expect(src).toBeDefined();
          if (view.coverage === "no_city_site") {
            expect(r.statement.regionLocationName).toBe(status.provinceAggregate?.location.locationName);
            expect(r.statement.regionLocationName).not.toBe(status.location.locationName);
          }
        }
        if (view.coverage === "no_city_site" && !showRegional) expect(view.rows).toEqual([]);
      }),
    );
  });
});

describe("UI-7 provenance", () => {
  const fields = ["Viral_Activity_Level", "latestLevel", "latestTrend", "weekStart"] as const;

  it("Property 11 UI-7.1 UI-7.2: complete and attributed to PHAC", () => {
    const view = buildCityView({ status: statusFor("toronto"), envelope, showRegional: false, today: TODAY });
    const stmts = view.rows.map((r) => r.statement);
    fc.assert(
      fc.property(fc.constantFrom(...stmts), fc.constantFrom(...fields), (stmt: NearStatement, field) => {
        const p = provenanceFor(stmt, field, { locationId: "toronto", grouping: "city", locationName: "Toronto" });
        expect(p.snapshotId).toBe(stmt.snapshotId);
        expect(p.snapshotId).not.toBe("");
        expect(p.field).toBe(field);
        expect(p.ruleId).toBe(stmt.ruleId);
        expect(p.sourceUrl).toBe(stmt.sourceUrl);
        expect(p.interpretationMethod).toBe("publisher");
        expect(p.interpretationText).toBe("Published by PHAC");
        expect(p.statement).toContain("Toronto");
        expect(checkWording(p.statement).passed).toBe(true);
      }),
    );
  });
});
