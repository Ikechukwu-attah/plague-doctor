import { describe, it, expect, beforeAll } from "vitest";
import * as fc from "fast-check";
import { readFileSync } from "fs";
import { join } from "path";
import { parseTrend } from "../../src/server/ingest/parse-trend";
import { parseAggregate } from "../../src/server/ingest/parse-aggregate";
import { buildCard } from "../../src/evidence/card";
import type { StatusObservation, MeasuredWeek, LocationEntry } from "../../src/evidence/types";
import type { NearStatement, HistoricalContext } from "../../src/evidence/card-types";

// Schemas require snapshotId to be a 64-char sha256 hex string.
const SID = "0".repeat(64);
const TREND_URL =
  "https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv";
const AGG_URL =
  "https://health-infobase.canada.ca/src/data/wastewater/wastewater_aggregate.csv";

let observations: StatusObservation[] = [];
let history: MeasuredWeek[] = [];

beforeAll(() => {
  const trendBytes = readFileSync(
    join(process.cwd(), "fixtures/trend-oct-2026.real.csv"),
  );
  const aggBytes = readFileSync(
    join(process.cwd(), "fixtures/aggregate-oct-2026.real.csv"),
  );
  observations = parseTrend(trendBytes, "trend-oct-2026", SID, TREND_URL).observations;
  history = parseAggregate(aggBytes, SID, AGG_URL).weeks;
});

/** Construct a minimal LocationEntry for a resolved city. */
function locationEntry(
  locationId: string,
  pruid: string,
  locationName: string,
  province: string,
): LocationEntry {
  return {
    locationId,
    locationName,
    city: locationName,
    province,
    pruid,
    grouping: "city",
    coverage: "city_site",
  };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function hasActivityIndex(s: NearStatement | HistoricalContext): boolean {
  return Object.prototype.hasOwnProperty.call(s, "activityIndex");
}

describe("EVD-4: Event card builder", () => {
  it("EVD-4: Halifax Christmas card is too_early with only historical context", () => {
    const loc = locationEntry("halifax", "12", "Halifax", "Nova Scotia");
    const card = buildCard(
      {
        locationId: "halifax",
        eventDate: "2026-12-25",
        setting: "dinner",
        attendeeCategories: [],
        createdAt: "2026-10-31T00:00:00Z",
        today: "2026-10-31",
      },
      { observations, history, locationEntry: loc },
    );

    expect(card.timingState).toBe("too_early");
    for (const s of card.statements) {
      expect(hasActivityIndex(s)).toBe(false);
      expect((s as HistoricalContext).label).toBe(
        "past observations, not a prediction",
      );
    }
  });

  it("EVD-4: Toronto next-Saturday card shows real Oct-18 values", () => {
    const loc = locationEntry("toronto", "35", "Toronto", "Ontario");
    const card = buildCard(
      {
        locationId: "toronto",
        eventDate: "2026-11-07",
        setting: "party",
        attendeeCategories: [],
        createdAt: "2026-10-31T00:00:00Z",
        today: "2026-10-31",
      },
      { observations, history, locationEntry: loc },
    );

    expect(card.timingState).toBe("near");

    const covidStmt = (card.statements as NearStatement[]).find(
      (s) => s.pathogen === "covid19",
    )!;
    const sourceObs = observations.find(
      (o) => o.locationId === "toronto" && o.pathogen === "covid19",
    )!;
    expect(covidStmt.activityIndex).toBe(sourceObs.activityIndex);
    expect(covidStmt.weekStart).toBe("2026-10-18");
  });

  it("EVD-4: Ottawa card offers Ontario aggregate labelled regional", () => {
    const loc = locationEntry("ottawa", "35", "Ottawa", "Ontario");
    const card = buildCard(
      {
        locationId: "ottawa",
        eventDate: "2026-11-07",
        setting: "meetup",
        attendeeCategories: [],
        createdAt: "2026-10-31T00:00:00Z",
        today: "2026-10-31",
      },
      { observations, history, locationEntry: loc },
    );

    expect(card.coverageType).toBe("no_city_site");
    expect(card.regionalObservation).toBeDefined();
    expect(card.regionalObservation!.grouping).toBe("province");
    expect(card.regionalObservation!.pruid).toBe("35");
  });

  it("EVD-4 P2: NA/missing observations never yield low or not_detected", () => {
    // Feature: evidence-engine, Property 2
    const unknownObs = observations.filter((o) => o.activityIndex === "unknown");
    // Ensure the fixture actually exercises this path.
    expect(unknownObs.length).toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.constantFrom(...unknownObs),
        fc.integer({ min: 0, max: 21 }),
        (obs, daysAhead) => {
          const today = "2026-10-31";
          const eventDate = addDays(today, daysAhead);
          const loc = locationEntry(
            obs.locationId,
            obs.pruid,
            obs.locationName,
            obs.province,
          );
          const card = buildCard(
            {
              locationId: obs.locationId,
              eventDate,
              setting: "test",
              attendeeCategories: [],
              createdAt: "2026-10-31T00:00:00Z",
              today,
            },
            { observations, history, locationEntry: loc },
          );
          const stmt = (card.statements as NearStatement[]).find(
            (s) => s.pathogen === obs.pathogen,
          )!;
          return (
            stmt.activityIndex !== "low" &&
            stmt.activityIndex !== "not_detected" &&
            stmt.activityIndex === "unknown"
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("EVD-4 P3: too_early cards contain zero activityIndex statements", () => {
    // Feature: evidence-engine, Property 3
    const loc = locationEntry("toronto", "35", "Toronto", "Ontario");
    fc.assert(
      fc.property(fc.integer({ min: 22, max: 365 }), (daysAhead) => {
        const today = "2026-10-31";
        const eventDate = addDays(today, daysAhead);
        const card = buildCard(
          {
            locationId: "toronto",
            eventDate,
            setting: "test",
            attendeeCategories: [],
            createdAt: "2026-10-31T00:00:00Z",
            today,
          },
          { observations, history, locationEntry: loc },
        );
        if (card.timingState !== "too_early") return false;
        return card.statements.every(
          (s) =>
            !hasActivityIndex(s) &&
            (s as { interpretationMethod?: string }).interpretationMethod !==
              "publisher",
        );
      }),
      { numRuns: 100 },
    );
  });

  it("EVD-4 P6: activityIndex always equals source Viral_Activity_Level — oct-2026 fixture", () => {
    // Feature: evidence-engine, Property 6
    const cityObs = observations.filter((o) => o.grouping === "city");
    expect(cityObs.length).toBeGreaterThan(0);

    fc.assert(
      fc.property(fc.constantFrom(...cityObs), (obs) => {
        const today = "2026-10-31";
        const loc = locationEntry(
          obs.locationId,
          obs.pruid,
          obs.locationName,
          obs.province,
        );
        const card = buildCard(
          {
            locationId: obs.locationId,
            eventDate: "2026-11-07",
            setting: "test",
            attendeeCategories: [],
            createdAt: "2026-10-31T00:00:00Z",
            today,
          },
          { observations, history, locationEntry: loc },
        );
        const stmt = (card.statements as NearStatement[]).find(
          (s) => s.pathogen === obs.pathogen,
        )!;
        return stmt.activityIndex === obs.activityIndex;
      }),
      { numRuns: 100 },
    );
  });
});

describe("EVD-4.7: regional marking of NearStatements", () => {
  function nearCard(id: string, pruid: string, name: string, province: string) {
    return buildCard(
      {
        locationId: id,
        eventDate: "2026-11-07",
        setting: "dinner",
        attendeeCategories: [],
        createdAt: "2026-10-31T00:00:00Z",
        today: "2026-10-31",
      },
      { observations, history, locationEntry: locationEntry(id, pruid, name, province) },
    );
  }

  it("EVD-4.7: Ottawa NearStatements are marked regional with regionLocationName Ontario", () => {
    const c = nearCard("ottawa", "35", "Ottawa", "Ontario");
    expect(c.statements.length).toBe(4);
    for (const s of c.statements as NearStatement[]) {
      expect(s.regional).toBe(true);
      expect(s.regionLocationName).toBe("Ontario");
    }
  });

  it("EVD-4.7: Toronto NearStatements are not marked regional", () => {
    const c = nearCard("toronto", "35", "Toronto", "Ontario");
    for (const s of c.statements as NearStatement[]) {
      expect(s.regional).toBeUndefined();
      expect(s.regionLocationName).toBeUndefined();
    }
  });
});
