import { describe, it, expect, beforeAll } from "vitest";
import * as fc from "fast-check";
import { readFileSync } from "fs";
import { join } from "path";
import { parseTrend } from "../../src/server/ingest/parse-trend";
import { parseAggregate } from "../../src/server/ingest/parse-aggregate";
import { buildCard } from "../../src/evidence/card";
import { generateShareText } from "../../src/evidence/share";
import { checkWording } from "../../src/evidence/wording-guard";
import type { StatusObservation, MeasuredWeek, LocationEntry } from "../../src/evidence/types";

const SID = "0".repeat(64);
const TREND_URL = "https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv";
const AGG_URL = "https://health-infobase.canada.ca/src/data/wastewater/wastewater_aggregate.csv";

let observations: StatusObservation[] = [];
let history: MeasuredWeek[] = [];

beforeAll(() => {
  observations = parseTrend(readFileSync(join(process.cwd(), "fixtures/trend-oct-2026.real.csv")), "trend-oct-2026", SID, TREND_URL).observations;
  history = parseAggregate(readFileSync(join(process.cwd(), "fixtures/aggregate-oct-2026.real.csv")), SID, AGG_URL).weeks;
});

function loc(locationId: string, pruid: string, name: string, province: string): LocationEntry {
  return { locationId, locationName: name, city: name, province, pruid, grouping: "city", coverage: "city_site" };
}

function card(locationId: string, pruid: string, name: string, province: string, eventDate: string, attendees: string[] = []) {
  return buildCard(
    { locationId, eventDate, setting: "dinner", attendeeCategories: attendees, createdAt: "2026-10-31T00:00:00Z", today: "2026-10-31" },
    { observations, history, locationEntry: loc(locationId, pruid, name, province) },
  );
}

describe("EVD-5: Share text generator", () => {
  it("near card: includes 'as of week of Oct 18, 2026, not on your event date' and source URL", () => {
    const text = generateShareText(card("toronto", "35", "Toronto", "Ontario", "2026-11-07"));
    expect(text).toContain("as of week of Oct 18, 2026, not on your event date");
    expect(text.toLowerCase()).toContain("source:");
  });

  it("past card: includes 'observed week of' and no PHAC activity label", () => {
    const text = generateShareText(card("toronto", "35", "Toronto", "Ontario", "2026-09-27"));
    expect(text).toContain("observed week of");
    // no current activity classification labels
    expect(text).not.toMatch(/\b(High|Moderate|Low|Not detected)\b/);
  });

  it("too_early card: includes 'Too early to know — not conditions on your date'", () => {
    const text = generateShareText(card("halifax", "12", "Halifax", "Nova Scotia", "2026-12-25"));
    expect(text).toContain("Too early to know — not conditions on your date");
  });

  it("all timing states pass the wording guard", () => {
    const near = generateShareText(card("toronto", "35", "Toronto", "Ontario", "2026-11-07"));
    const past = generateShareText(card("toronto", "35", "Toronto", "Ontario", "2026-09-27"));
    const early = generateShareText(card("halifax", "12", "Halifax", "Nova Scotia", "2026-12-25"));
    expect(checkWording(near).passed, `near: ${checkWording(near).violations.join()}`).toBe(true);
    expect(checkWording(past).passed, `past: ${checkWording(past).violations.join()}`).toBe(true);
    expect(checkWording(early).passed, `early: ${checkWording(early).violations.join()}`).toBe(true);
  });

  it("deterministic: same card → identical text", () => {
    const c = card("toronto", "35", "Toronto", "Ontario", "2026-11-07");
    expect(generateShareText(c)).toBe(generateShareText(c));
  });

  it("EVD-5 P8: share text never contains attendee categories", () => {
    // Feature: evidence-engine, Property 8
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("older adults", "infants", "immunocompromised"), { minLength: 1, maxLength: 3 }),
        fc.constantFrom("2026-11-07", "2026-09-27", "2026-12-25"),
        (attendees, eventDate) => {
          const text = generateShareText(card("toronto", "35", "Toronto", "Ontario", eventDate, attendees));
          return attendees.every((a) => !text.includes(a));
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("EVD-2.10/EVD-4.7/EVD-5: regional labelling and sources", () => {
  it("EVD-2.10/EVD-4.7: Ottawa share text labels Ontario provincial aggregate and never presents values as Ottawa's", () => {
    const text = generateShareText(card("ottawa", "35", "Ottawa", "Ontario", "2026-11-07"));
    const lines = text.split("\n");
    const notice = "No Ottawa monitoring site — showing Ontario provincial aggregate (PHAC), not Ottawa";
    expect(text).toContain("Ontario");
    expect(text).toContain("provincial aggregate");
    expect(lines).toContain(notice);
    const virusIdx = lines.map((l, i) => (/^(COVID-19|Flu A|Flu B|RSV)/.test(l) ? i : -1)).filter((i) => i >= 0);
    expect(virusIdx.length).toBeGreaterThan(0);
    expect(lines.indexOf(notice)).toBeLessThan(virusIdx[0] ?? -1);
    for (const i of virusIdx) expect(lines[i]).toContain("Ontario provincial aggregate");
    expect(checkWording(text).passed, checkWording(text).violations.join()).toBe(true);
  });

  it("EVD-5: too_early and past share text cite the aggregate CSV, not the trend CSV", () => {
    const early = generateShareText(card("toronto", "35", "Toronto", "Ontario", "2026-12-25"));
    const past = generateShareText(card("toronto", "35", "Toronto", "Ontario", "2026-09-27"));
    const near = generateShareText(card("toronto", "35", "Toronto", "Ontario", "2026-11-07"));
    for (const t of [early, past]) {
      expect(t).toContain("wastewater_aggregate.csv");
      expect(t).not.toContain("wastewater_trend.csv");
    }
    expect(near).toContain("wastewater_trend.csv");
  });

  it("EVD-5: historical ranges say what the numbers are", () => {
    // The trimmed real fixture only holds EpiWeeks 38–42, so build a too_early
    // card by moving `today` back (real history rows, earlier "today").
    const earlyCard = buildCard(
      { locationId: "toronto", eventDate: "2026-10-04", setting: "dinner", attendeeCategories: [], createdAt: "2026-09-01T00:00:00Z", today: "2026-09-01" },
      { observations, history, locationEntry: loc("toronto", "35", "Toronto", "Ontario") },
    );
    expect(earlyCard.timingState).toBe("too_early");
    const early = generateShareText(earlyCard);
    const past = generateShareText(card("toronto", "35", "Toronto", "Ontario", "2026-09-27"));
    expect(early).toContain("PHAC units");
    expect(early).toContain("not a prediction");
    expect(past).toContain("PHAC units");
    expect(checkWording(early).passed, checkWording(early).violations.join()).toBe(true);
    expect(checkWording(past).passed, checkWording(past).violations.join()).toBe(true);
  });
});
