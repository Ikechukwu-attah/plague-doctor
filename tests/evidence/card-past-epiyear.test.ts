import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildCard } from "../../src/evidence/card";
import { dateToEpiWeek } from "../../src/evidence/date-utils";
import type { MeasuredWeek, LocationEntry } from "../../src/evidence/types";
import type { HistoricalContext } from "../../src/evidence/card-types";

// Real PHAC-derived history (read-only).
const history: MeasuredWeek[] = JSON.parse(
  readFileSync(
    join(process.cwd(), "data/normalized/history/toronto-fluA.json"),
    "utf8",
  ),
) as MeasuredWeek[];

const loc: LocationEntry = {
  locationId: "toronto",
  locationName: "Toronto",
  city: "Toronto",
  province: "Ontario",
  pruid: "35",
  grouping: "city",
  coverage: "city_site",
};

function fluAPast(eventDate: string): HistoricalContext {
  const card = buildCard(
    {
      locationId: "toronto",
      eventDate,
      setting: "dinner",
      attendeeCategories: [],
      createdAt: "2026-10-31T00:00:00Z",
      today: "2026-10-31",
    },
    { observations: [], history, locationEntry: loc },
  );
  expect(card.timingState).toBe("past");
  return card.statements.find(
    (s) => s.pathogen === "fluA",
  ) as HistoricalContext;
}

describe("EVD-3.7 / 18.6: past card matches EpiYear and EpiWeek", () => {
  it("returns each year's own wAvg for the same EpiWeek; band is constant", () => {
    const week = [...new Set(history.map((w) => w.epiWeek))].find(
      (wk) =>
        new Set(history.filter((w) => w.epiWeek === wk).map((w) => w.epiYear))
          .size >= 3,
    )!;
    const rows = history.filter((w) => w.epiWeek === week);
    const years = [...new Set(rows.map((r) => r.epiYear))];
    expect(years.length).toBeGreaterThanOrEqual(2);

    const bands = new Set<string>();
    const wAvgs = new Set<number>();
    for (const row of rows) {
      const ctx = fluAPast(row.weekStart);
      expect(dateToEpiWeek(row.weekStart).epiYear).toBe(row.epiYear);
      expect(ctx.wAvg).toBe(row.wAvg);
      expect(ctx.weekStart).toBe(row.weekStart);
      bands.add(`${ctx.histMin}|${ctx.histMax}`);
      wAvgs.add(ctx.wAvg as number);
    }
    expect(wAvgs.size).toBe(rows.length);
    expect(bands.size).toBe(1);
  });

  it("keeps a gap (no borrowed wAvg) when the event's year has no row, band intact", () => {
    // Pick the gap dynamically: scan Sundays from a year before the earliest
    // history week to the latest; find a date whose own EpiYear/EpiWeek has no
    // row while another year does for the same EpiWeek.
    const sundays: string[] = [];
    const cursor = new Date(`${history[0]!.weekStart}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() - 7 * 52);
    const end = new Date(`${history[history.length - 1]!.weekStart}T12:00:00Z`);
    for (; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
      sundays.push(cursor.toISOString().slice(0, 10));
    }
    const hit = sundays
      .map((eventDate) => ({ eventDate, ...dateToEpiWeek(eventDate) }))
      .find(
        (c) =>
          !history.some(
            (w) => w.epiYear === c.epiYear && w.epiWeek === c.epiWeek,
          ) && history.some((w) => w.epiWeek === c.epiWeek),
      );
    expect(hit).toBeDefined();
    const earlier = history.find((w) => w.epiWeek === hit!.epiWeek)!;
    const ctx = fluAPast(hit!.eventDate);
    expect(ctx.wAvg).toBeNull();
    expect(ctx.weekStart).toBeUndefined();
    expect(ctx.histMin).toBe(earlier.histMin);
    expect(ctx.histMax).toBe(earlier.histMax);
  });
});
