/**
 * UI-19.20 status explanations, UI-19.21 recent PHAC weeks.
 * History rows are real PHAC aggregate rows (data/normalized/history/toronto-fluA.json);
 * the gap/null generators are `synthetic`.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { readFileSync } from "fs";
import { join } from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { checkWording } from "../../src/evidence/wording-guard";
import { addDaysIso } from "../../src/evidence/date-utils";
import type { MeasuredWeek } from "../../src/evidence/types";
import { buildRecentWeeks } from "../../src/components/city/recent-weeks";
import { RecentWeeks } from "../../src/components/city/RecentWeeks";
import { ProvenanceDialogBody } from "../../src/components/city/ProvenanceDialog";
import { StatusExplainer } from "../../src/components/city/StatusExplainer";
import * as copy from "../../src/ui-copy";
import { NA1_DEFINITION, NA2_DEFINITION, MISSING_VS_ZERO } from "../../src/ui-copy/methods";

const real: MeasuredWeek[] = (JSON.parse(
  readFileSync(join(process.cwd(), "data/normalized/history/toronto-fluA.json"), "utf8"),
) as MeasuredWeek[]).slice(-40);

const text = (html: string): string => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("UI-19.20 status explanations", () => {
  const all = copy.STATUS_TOPICS.map((t) => [t.heading, ...t.body].join(" ")).join(" ");

  it("covers the five topics from existing PHAC-sourced copy", () => {
    expect(copy.STATUS_TOPICS.map((t) => t.id)).toEqual(["levels", "trend", "sample_weeks", "unknowns", "community"]);
    expect(all).toMatch(/High, Moderate and Low/);
    expect(all).toMatch(/PHAC's own activity categories/);
    expect(all).toMatch(/previous 5 weeks/);
    expect(all).toMatch(/different weeks/);
    expect(all).toContain(NA1_DEFINITION);
    expect(all).toContain(NA2_DEFINITION);
    expect(all).toContain(MISSING_VS_ZERO);
    expect(all).toMatch(/not your personal chance of getting sick/);
  });

  it("passes the wording guard", () => {
    for (const t of copy.STATUS_TOPICS) {
      for (const s of [t.heading, ...t.body]) expect(checkWording(s).violations, s).toEqual([]);
    }
  });

  it("city page explainer renders all five topics; dialog renders field topics", () => {
    const page = renderToStaticMarkup(<StatusExplainer />);
    for (const t of copy.STATUS_TOPICS) expect(page).toContain(`data-topic="${t.id}"`);
    const model = {
      statement: "Flu A in Toronto: Moderate",
      snapshotId: "abc",
      field: "latestTrend" as const,
      locationId: "toronto",
      grouping: "city" as const,
      ruleId: "r",
      interpretationMethod: "publisher" as const,
      interpretationText: "Published by PHAC" as const,
      sourceUrl: "https://example.test/x.csv",
    };
    const dlg = renderToStaticMarkup(<ProvenanceDialogBody model={model} titleId="t" explain />);
    expect(dlg).toContain('data-topic="trend"');
    expect(dlg).toContain('data-topic="community"');
  });
});

describe("UI-19.21 recent PHAC weeks", () => {
  it("real history: 12 consecutive weeks ending at the latest measured week", () => {
    const m = buildRecentWeeks(real);
    expect(m.entries).toHaveLength(12);
    expect(m.endWeek).toBe(real[real.length - 1]!.weekStart);
    expect(m.entries[11]!.weekStart).toBe(m.endWeek);
  });

  it("a removed week is marked missing with the gap label", () => {
    const end = real[real.length - 1]!.weekStart;
    const gap = addDaysIso(end, -21);
    const m = buildRecentWeeks(real.filter((w) => w.weekStart !== gap));
    const e = m.entries.find((x) => x.weekStart === gap)!;
    expect(e.status).toBe("missing");
    expect(e.wAvg).toBeNull();
    expect(e.label).toContain("no sample published for this week");
    const html = renderToStaticMarkup(<RecentWeeks model={m} />);
    expect(html).toContain('data-status="missing"');
    expect(checkWording(text(html)).violations).toEqual([]);
  });

  it("property: never interpolates, covers calendar weeks, flags gaps (synthetic gaps over real rows)", () => {
    const flags = fc.array(fc.constantFrom("keep", "drop", "null"), { minLength: 40, maxLength: 40 });
    fc.assert(
      fc.property(flags, fc.integer({ min: 1, max: 14 }), (fl, count) => {
        const weeks = real.flatMap((w, i) =>
          fl[i] === "drop" ? [] : [{ ...w, wAvg: fl[i] === "null" ? null : w.wAvg }],
        );
        const m = buildRecentWeeks(weeks, count);
        const measuredWeeks = weeks.filter((w) => w.wAvg !== null);
        if (measuredWeeks.length === 0) {
          expect(m.entries).toEqual([]);
          return;
        }
        const end = measuredWeeks.map((w) => w.weekStart).sort().at(-1)!;
        expect(m.endWeek).toBe(end);
        expect(m.entries.map((e) => e.weekStart)).toEqual(
          Array.from({ length: count }, (_, i) => addDaysIso(end, -7 * (count - 1 - i))),
        );
        const src = new Map(weeks.map((w) => [w.weekStart, w.wAvg]));
        for (const e of m.entries) {
          const v = src.get(e.weekStart) ?? null;
          if (v === null) {
            expect(e.status).toBe("missing");
            expect(e.wAvg).toBeNull();
            expect(e.label).toContain("no sample published");
          } else {
            expect(e.status).toBe("measured");
            expect(e.wAvg).toBe(v);
          }
        }
        expect(m.measured + m.missing).toBe(count);
      }),
      { numRuns: 200 },
    );
  });
});
