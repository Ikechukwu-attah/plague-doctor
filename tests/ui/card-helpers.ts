/**
 * Card test helpers (UI-9, UI-10). Observations and history are real PHAC bytes
 * (fixtures + data/normalized); locations, dates and attendee subsets are synthetic.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as fc from "fast-check";
import { buildCard } from "../../src/evidence/card";
import type { EventCard } from "../../src/evidence/card-types";
import type { LocationEntry, MeasuredWeek } from "../../src/evidence/types";
import { ATTENDEE_CATEGORIES, KINDS, VENUES } from "../../src/ui-copy/planner-options";
import { loadTrendFixture } from "./helpers";

export const TORONTO: LocationEntry = {
  locationId: "toronto",
  locationName: "Toronto",
  city: "Toronto",
  province: "Ontario",
  pruid: "35",
  grouping: "city",
  coverage: "city_site",
};

/** synthetic: a Gazetteer city with no PHAC city site, so the Ontario aggregate is offered. */
export const OTTAWA: LocationEntry = {
  locationId: "ottawa",
  locationName: "Ottawa",
  city: "Ottawa",
  province: "Ontario",
  pruid: "35",
  grouping: "city",
  coverage: "no_city_site",
};

let hist: MeasuredWeek[] | undefined;
export function history(): MeasuredWeek[] {
  hist ??= (["covid19", "fluA", "fluB", "rsv"] as const).flatMap(
    (p) =>
      JSON.parse(
        readFileSync(join(process.cwd(), "data/normalized/history/toronto-" + p + ".json"), "utf8"),
      ) as MeasuredWeek[],
  );
  return hist;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const TODAY = "2026-10-31";
export const settingArb = fc
  .tuple(fc.constantFrom(...VENUES.map((v) => v.id)), fc.constantFrom(...KINDS.map((k) => k.id)))
  .map(([v, k]) => v + "." + k);
export const attendeesArb = fc.subarray([...ATTENDEE_CATEGORIES]);

export function makeCard(o: {
  loc: LocationEntry;
  offsetDays: number;
  setting: string;
  attendees: string[];
  createdAt?: string;
}): EventCard {
  return buildCard(
    {
      locationId: o.loc.locationId,
      eventDate: addDays(TODAY, o.offsetDays),
      setting: o.setting,
      attendeeCategories: o.attendees,
      createdAt: o.createdAt ?? "2026-10-31T15:00:00.000Z",
      today: TODAY,
    },
    { observations: loadTrendFixture(), history: history(), locationEntry: o.loc },
  );
}

export const cardArb: fc.Arbitrary<EventCard> = fc
  .record({
    loc: fc.constantFrom(TORONTO, OTTAWA),
    offsetDays: fc.integer({ min: -700, max: 120 }),
    setting: settingArb,
    attendees: attendeesArb,
  })
  .map(makeCard);

/** Every string reachable in a value. */
export function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => allStrings(x, out));
  return out;
}
