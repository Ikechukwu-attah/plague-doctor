import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { renderToStaticMarkup } from "react-dom/server";
import * as fc from "fast-check";
import { MethodsView } from "../../src/components/methods/MethodsView";
import {
  buildCoverageFacts,
  buildIngestionFailure,
} from "../../src/lib/view/coverage-facts";
import { buildThreeClocks } from "../../src/lib/view/three-clocks";
import { ApiError } from "../../src/lib/api/errors";
import { TREND_SOURCE_URL } from "../../src/evidence/copy/sources";
import { loadTrendFixture, textOf, FIXTURE_SNAPSHOT_ID } from "./helpers";
import type { LocationEntry, SourceSnapshot } from "../../src/evidence/types";

const entry = (id: string, grouping: LocationEntry["grouping"], coverage: LocationEntry["coverage"]): LocationEntry => ({
  locationId: id,
  locationName: id,
  city: id,
  province: "P",
  pruid: "1",
  grouping,
  coverage,
});

const snap = (over: Partial<SourceSnapshot>): SourceSnapshot => ({
  snapshotId: FIXTURE_SNAPSHOT_ID,
  sourceUrl: TREND_SOURCE_URL,
  fetchedAt: "2026-11-02T10:00:00.000Z",
  lastModified: "Fri, 30 Oct 2026 14:00:00 GMT",
  origin: "live",
  schemaVersion: "oct-2026",
  rowCount: 10,
  rejectedRows: 0,
  status: "valid",
  ...over,
});

describe("UI-11.9 buildCoverageFacts", () => {
  it("counts snapshot locations, gazetteer-only places and stopped locations from the real fixture", () => {
    const obs = loadTrendFixture();
    const ids = [...new Set(obs.map((o) => o.locationId))];
    const locations = ids.map((id) => entry(id, obs.find((o) => o.locationId === id)!.grouping, "city_site"));
    const facts = buildCoverageFacts({ locations, observations: obs });
    expect(facts.locations).toBe(ids.length);
    const g = facts.byGrouping;
    expect(g.site + g.city + g.province + g.national).toBe(ids.length);
    expect(facts.discontinued).toBeLessThanOrEqual(ids.length);
    expect(facts.withoutCoverage).toBe(0);
  });

  it("counts derived only from inputs: arbitrary names never change the counts", () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { minLength: 1, maxLength: 8 }), (names) => {
        const ids = [...new Set(names)].map((n, i) => `id-${i}`);
        const locations = ids.map((id, i) => ({ ...entry(id, "city", "city_site"), locationName: names[i] ?? "" }));
        expect(buildCoverageFacts({ locations, observations: [] }).locations).toBe(ids.length);
      }),
    );
  });

  it("marks a location stopped only when every observation is NA2 or No Recent Data", () => {
    const base = loadTrendFixture()[0]!;
    const stopped = { ...base, locationId: "a", unknownReason: "na2_not_sampling" as const, activityIndex: "unknown" as const };
    const live = { ...base, locationId: "a", unknownReason: undefined, trend: "stable" as const, activityIndex: "low" as const };
    const locations = [entry("a", "city", "city_site")];
    expect(buildCoverageFacts({ locations, observations: [stopped] }).discontinued).toBe(1);
    expect(buildCoverageFacts({ locations, observations: [stopped, live] }).discontinued).toBe(0);
  });

  it("hardcodes no place names in the module source", () => {
    const src = readFileSync("src/lib/view/coverage-facts.ts", "utf8");
    const names = loadTrendFixture().flatMap((o) => [o.city, o.locationName]).filter((n) => n.length >= 4);
    for (const n of new Set(names)) {
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Standalone words only, so identifiers like toTorontoDateString are not flagged.
      expect(new RegExp(`(?<![A-Za-z])${esc}(?![A-Za-z])`).test(src), n).toBe(false);
    }
  });
});

describe("UI-11.11 buildIngestionFailure", () => {
  const status = { latestSampleWeekByPathogen: { covid19: "2026-10-18", rsv: "2026-10-11" }, lastSuccessfulFetch: null };

  it("is absent when nothing was rejected", () => {
    expect(buildIngestionFailure({ dataStatus: status, snapshots: [snap({})] })).toBeUndefined();
  });

  it("reports a rejected snapshot newer than the latest valid one with the last valid week", () => {
    const f = buildIngestionFailure({
      dataStatus: status,
      snapshots: [snap({}), snap({ snapshotId: "b".repeat(64), status: "rejected", fetchedAt: "2026-11-05T10:00:00.000Z", rejectedRows: 7 })],
    });
    expect(f?.detail).toContain("rejected");
    expect(f?.detail).toContain("7 rejected rows");
    expect(f?.lastValidWeek).toBe("week of Oct 18, 2026");
  });

  it("ignores a rejected snapshot older than a valid one", () => {
    const f = buildIngestionFailure({
      dataStatus: status,
      snapshots: [snap({ status: "rejected", fetchedAt: "2026-10-01T10:00:00.000Z" }), snap({})],
    });
    expect(f).toBeUndefined();
  });

  it("reports a failed data-status request with its HTTP status", () => {
    const f = buildIngestionFailure({ dataStatusError: new ApiError("data-status", "http", "/api/data-status", 503) });
    expect(f?.detail).toContain("503");
    expect(f?.lastValidWeek).toBeUndefined();
  });
});

describe("UI-11.1 to 11.11 MethodsView markup", () => {
  const clocks = buildThreeClocks({
    dataStatus: { latestSampleWeekByPathogen: { covid19: "2026-10-18" }, trendSnapshotId: FIXTURE_SNAPSHOT_ID },
    snapshots: [snap({})],
  });
  const ready = textOf(renderToStaticMarkup(<MethodsView clocks={clocks} coverage={{ locations: 5, byGrouping: { site: 2, city: 1, province: 1, national: 1 }, withoutCoverage: 3, discontinued: 1 }} />));

  it("defines NA1 and NA2", () => {
    expect(ready).toContain("NA1");
    expect(ready).toContain("under 12 months");
    expect(ready).toContain("NA2");
    expect(ready).toContain("stopped sampling");
  });

  it("states the 50% / 75% coverage rule", () => {
    expect(ready).toContain("50% population coverage");
    expect(ready).toContain("75% nationally");
  });

  it("states non-endorsement and labels the freshness convention as ours", () => {
    expect(ready).toContain("implies no endorsement");
    expect(ready).toContain("our convention, not PHAC's");
  });

  it("shows schema version, snapshot ID, derived facts and the six source links", () => {
    expect(ready).toContain("Schema version in use: oct-2026");
    expect(ready).toContain(`Latest snapshot ID: ${FIXTURE_SNAPSHOT_ID}`);
    expect(ready).toContain("This snapshot lists 5 locations, 1 of them");
    const html = renderToStaticMarkup(<MethodsView clocks={clocks} coverage={null} />);
    expect((html.match(/href="https:\/\/health-infobase/g) ?? []).length).toBe(5);
    expect(html).toContain("reduce-spread");
  });

  it("shows skeletons for clocks and facts while pending, static prose still renders", () => {
    const html = renderToStaticMarkup(<MethodsView clocks={null} coverage={null} />);
    expect((html.match(/aria-busy="true"/g) ?? []).length).toBe(2);
    expect(textOf(html)).toContain("NA1");
  });

  it("renders the ingestion failure with detail and last valid sample week", () => {
    const html = textOf(
      renderToStaticMarkup(
        <MethodsView clocks={clocks} coverage={null} failure={{ detail: "the trend file was rejected", lastValidWeek: "week of Oct 18, 2026" }} />,
      ),
    );
    expect(html).toContain("The latest ingestion failed: the trend file was rejected. Last valid sample week: week of Oct 18, 2026.");
  });

  it("renders no failure block when none is given", () => {
    expect(ready).not.toContain("ingestion failed");
  });
});
