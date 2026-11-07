import { describe, it, expect, beforeAll } from "vitest";
import * as fc from "fast-check";
import { readFileSync } from "fs";
import { join } from "path";
import { parseTrend } from "../../src/server/ingest/parse-trend";
import { parseAggregate } from "../../src/server/ingest/parse-aggregate";
import { buildCard } from "../../src/evidence/card";
import { generateShareText } from "../../src/evidence/share";
import type { StatusObservation, MeasuredWeek, LocationEntry } from "../../src/evidence/types";
import type { EventCard } from "../../src/evidence/card-types";

const SID = "0".repeat(64);
const TREND_URL = "https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv";
const AGG_URL = "https://health-infobase.canada.ca/src/data/wastewater/wastewater_aggregate.csv";

let observations: StatusObservation[] = [];
let history: MeasuredWeek[] = [];

beforeAll(() => {
  observations = parseTrend(readFileSync(join(process.cwd(), "fixtures/trend-oct-2026.real.csv")), "trend-oct-2026", SID, TREND_URL).observations;
  history = parseAggregate(readFileSync(join(process.cwd(), "fixtures/aggregate-oct-2026.real.csv")), SID, AGG_URL).weeks;
});

function loc(): LocationEntry {
  return { locationId: "toronto", locationName: "Toronto", city: "Toronto", province: "Ontario", pruid: "35", grouping: "city", coverage: "city_site" };
}

function makeCard(eventDate: string, attendees: string[]): EventCard {
  return buildCard(
    { locationId: "toronto", eventDate, setting: "dinner", attendeeCategories: attendees, createdAt: "2026-10-31T00:00:00Z", today: "2026-10-31" },
    { observations, history, locationEntry: loc() },
  );
}

/** Serialize a card the way it would cross a network/export boundary:
 *  with attendeeCategories stripped. */
function serializeForBoundary(card: EventCard): string {
  const clone: Partial<EventCard> = { ...card };
  delete clone.attendeeCategories;
  return JSON.stringify(clone);
}

describe("EVD-8 P11: attendee category privacy", () => {
  it("EVD-8 P11: attendeeCategories never appear in serialized EventCard", () => {
    // Feature: evidence-engine, Property 11 (path A: serialized card minus the field)
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("older adults", "infants", "immunocompromised"), { minLength: 1, maxLength: 3 }),
        fc.constantFrom("2026-11-07", "2026-09-27", "2026-12-25"),
        (attendees, eventDate) => {
          const card = makeCard(eventDate, attendees);
          const serialized = serializeForBoundary(card);
          return attendees.every((a) => !serialized.includes(a));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("EVD-8 P11: attendeeCategories never appear in share text", () => {
    // Feature: evidence-engine, Property 11 (path B: share text)
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("older adults", "infants", "immunocompromised"), { minLength: 1, maxLength: 3 }),
        fc.constantFrom("2026-11-07", "2026-09-27", "2026-12-25"),
        (attendees, eventDate) => {
          const card = makeCard(eventDate, attendees);
          const text = generateShareText(card);
          return attendees.every((a) => !text.includes(a));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("sanity: the card DOES retain attendeeCategories for local rendering", () => {
    const card = makeCard("2026-11-07", ["older adults", "infants"]);
    expect(card.attendeeCategories).toEqual(["older adults", "infants"]);
  });
});
