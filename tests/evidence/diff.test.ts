import { describe, it, expect, beforeAll } from "vitest";
import * as fc from "fast-check";
import { readFileSync } from "fs";
import { join } from "path";
import { parseTrend } from "../../src/server/ingest/parse-trend";
import { parseAggregate } from "../../src/server/ingest/parse-aggregate";
import { buildCard } from "../../src/evidence/card";
import { diffCards } from "../../src/evidence/diff";
import type { StatusObservation, MeasuredWeek, LocationEntry } from "../../src/evidence/types";
import type { EventCard, NearStatement } from "../../src/evidence/card-types";

const SID = "0".repeat(64);
const SID2 = "1".repeat(64);
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

function torontoNearCard(): EventCard {
  return buildCard(
    { locationId: "toronto", eventDate: "2026-11-07", setting: "dinner", attendeeCategories: [], createdAt: "2026-10-31T00:00:00Z", today: "2026-10-31" },
    { observations, history, locationEntry: loc() },
  );
}

/** Deep clone a card via JSON (statements are plain data). */
function clone(card: EventCard): EventCard {
  return JSON.parse(JSON.stringify(card)) as EventCard;
}

const NO_INC_DEC = /\b(increas|decreas|rising|falling|worse)/i;

describe("EVD-6: Saved-event diff", () => {
  it("same card twice → all unchanged", () => {
    const c = torontoNearCard();
    const result = diffCards(c, clone(c));
    expect(result.entries.every((e) => e.status === "unchanged")).toBe(true);
  });

  it("same weekStart, different snapshotId → revised", () => {
    const base = torontoNearCard();
    const cur = clone(base);
    cur.snapshotId = SID2;
    (cur.statements as NearStatement[]).forEach((s) => { s.snapshotId = SID2; });
    const result = diffCards(base, cur);
    const revised = result.entries.filter((e) => e.status === "revised");
    expect(revised.length).toBeGreaterThan(0);
    for (const e of revised) {
      expect(e.baselineSnapshotId).toBe(SID);
      expect(e.newSnapshotId).toBe(SID2);
      expect(e.description ?? "").not.toMatch(NO_INC_DEC);
    }
  });

  it("newer weekStart + different value → changed with arrow, no increase/decrease words", () => {
    const base = torontoNearCard();
    const cur = clone(base);
    const stmts = cur.statements as NearStatement[];
    const s0 = stmts[0]!;
    s0.weekStart = "2026-10-25";
    s0.activityIndex = s0.activityIndex === "high" ? "low" : "high";
    s0.snapshotId = SID2;
    const result = diffCards(base, cur);
    const changed = result.entries.find((e) => e.pathogen === s0.pathogen)!;
    expect(changed.status).toBe("changed");
    expect(changed.description ?? "").toContain("→");
    expect(changed.description ?? "").not.toMatch(NO_INC_DEC);
  });

  it("pathogen value removed in current → newly_missing", () => {
    const base = torontoNearCard();
    const cur = clone(base);
    const stmts = cur.statements as NearStatement[];
    const s0 = stmts[0]!;
    s0.activityIndex = "unknown";
    const result = diffCards(base, cur);
    const entry = result.entries.find((e) => e.pathogen === s0.pathogen)!;
    // Only newly_missing if baseline had a real value
    const baseHad = (base.statements as NearStatement[])[0]!.activityIndex !== "unknown";
    if (baseHad) expect(entry.status).toBe("newly_missing");
    expect(entry.description ?? "").not.toMatch(NO_INC_DEC);
  });

  it("EVD-6 P10: diff output never uses increase/decrease language for missing or revised fields", () => {
    // Feature: evidence-engine, Property 10
    const base = torontoNearCard();
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("high", "moderate", "low", "not_detected", "unknown"), { minLength: 4, maxLength: 4 }),
        fc.boolean(),
        (levels, bumpSnapshot) => {
          const cur = clone(base);
          const stmts = cur.statements as NearStatement[];
          stmts.forEach((s, i) => {
            s.activityIndex = levels[i] as NearStatement["activityIndex"];
            if (bumpSnapshot) s.snapshotId = SID2;
          });
          if (bumpSnapshot) cur.snapshotId = SID2;
          const result = diffCards(base, cur);
          return result.entries
            .filter((e) => e.status === "newly_missing" || e.status === "revised")
            .every((e) => !NO_INC_DEC.test(e.description ?? ""));
        },
      ),
      { numRuns: 100 },
    );
  });
});
