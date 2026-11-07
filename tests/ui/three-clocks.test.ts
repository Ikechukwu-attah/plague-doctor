import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { freshnessFor } from "../../src/lib/view/freshness";
import { buildThreeClocks } from "../../src/lib/view/three-clocks";
import { buildCard } from "../../src/evidence/card";
import { TREND_SOURCE_URL, AGGREGATE_SOURCE_URL } from "../../src/evidence/copy/sources";
import { weekOf } from "../../src/ui-copy/timing";
import { observationArb, isoDateArb, FIXTURE_SNAPSHOT_ID } from "./helpers";
import type { LocationEntry, SourceSnapshot } from "../../src/evidence/types";

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

describe("UI-1.9 UI-14.7 UI-14.8 Property 19: freshness and three clocks", () => {
  it("freshnessFor equals buildCard freshnessLabel on real fixture rows (ignores ingest time)", () => {
    fc.assert(
      fc.property(observationArb(), isoDateArb, (obs, today) => {
        const entry: LocationEntry = {
          locationId: obs.locationId,
          locationName: obs.locationName,
          city: obs.city,
          province: obs.province,
          pruid: obs.pruid,
          grouping: obs.grouping,
          coverage: "city_site",
        };
        const card = buildCard(
          {
            locationId: obs.locationId,
            eventDate: today,
            setting: "synthetic",
            attendeeCategories: [],
            createdAt: "2026-11-02T00:00:00Z",
            today,
          },
          { observations: [obs], history: [], locationEntry: entry },
        );
        expect(freshnessFor(obs, today).label).toBe(card.freshnessLabel);
      }),
    );
  });

  it("freshnessFor ignores everything except the sample week, trend state and today", () => {
    fc.assert(
      fc.property(observationArb(), isoDateArb, fc.string(), fc.string(), (obs, today, a, b) => {
        const x = freshnessFor({ ...obs, snapshotId: a } as typeof obs, today);
        const y = freshnessFor({ ...obs, snapshotId: b } as typeof obs, today);
        expect(x).toEqual(y);
      }),
    );
  });

  it("known ages: 21 days latest, 22 delayed, 36 outdated; invalid week no data", () => {
    const base = { trend: "stable", activityIndex: "low", unknownReason: undefined } as const;
    expect(freshnessFor({ ...base, weekStart: "2026-10-04" }, "2026-10-25")).toEqual({ label: "latest_available", ageDays: 21 });
    expect(freshnessFor({ ...base, weekStart: "2026-10-04" }, "2026-10-26").label).toBe("delayed");
    expect(freshnessFor({ ...base, weekStart: "2026-10-04" }, "2026-11-09").label).toBe("outdated");
    expect(freshnessFor({ ...base, weekStart: "" }, "2026-11-09")).toEqual({ label: "no_data" });
  });

  it("buildThreeClocks uses only the valid PHAC trend snapshot matching trendSnapshotId", () => {
    const good = snap({});
    const junk: SourceSnapshot[] = [
      snap({ sourceUrl: AGGREGATE_SOURCE_URL, fetchedAt: "2030-01-01T00:00:00.000Z" }),
      snap({ status: "rejected", fetchedAt: "2031-01-01T00:00:00.000Z" }),
      snap({ snapshotId: "f".repeat(64), fetchedAt: "2032-01-01T00:00:00.000Z" }),
    ];
    const ds = {
      latestSampleWeekByPathogen: { covid19: "2026-10-18", fluA: "2026-10-25" },
      trendSnapshotId: FIXTURE_SNAPSHOT_ID,
      schemaVersion: "wrong",
    };
    const m = buildThreeClocks({ dataStatus: ds, snapshots: [...junk, good] });
    expect(m).toEqual({
      sampleWeek: "2026-10-25",
      phacFileUpdated: "2026-10-30",
      ourLastIngest: good.fetchedAt,
      snapshotId: FIXTURE_SNAPSHOT_ID,
      schemaVersion: "oct-2026",
    });
    expect(weekOf(m.sampleWeek!)).toMatch(/^week of /);
    // order of snapshots does not matter
    expect(buildThreeClocks({ dataStatus: ds, snapshots: [good, ...junk] })).toEqual(m);
  });

  it("missing match leaves clocks unavailable", () => {
    const m = buildThreeClocks({
      dataStatus: { latestSampleWeekByPathogen: {}, trendSnapshotId: null },
      snapshots: [snap({})],
    });
    expect(m).toEqual({});
  });
});
