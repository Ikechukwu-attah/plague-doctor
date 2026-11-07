/**
 * Timeline view model. Base rows are real PHAC aggregate rows (Toronto Flu A,
 * data/normalized/history); gap and shuffle generators are `synthetic`.
 * UI-6.x; design Properties 8, 9.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { readFileSync } from "fs";
import { join } from "path";
import { buildTimeline } from "../../src/lib/view/timeline";
import { checkWording } from "../../src/evidence/wording-guard";
import type { Activity, MeasuredWeek } from "../../src/evidence/types";

const real: MeasuredWeek[] = (JSON.parse(
  readFileSync(join(process.cwd(), "data/normalized/history/toronto-fluA.json"), "utf8"),
) as MeasuredWeek[]).slice(-60);

const SIZE = { w: 600, h: 200 };
const day = (iso: string): number => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/** synthetic: randomly null out wAvg / hist values and drop weeks, then shuffle. */
const inputArb = fc
  .tuple(
    fc.array(fc.record({ drop: fc.boolean(), nullAvg: fc.boolean(), nullBand: fc.boolean() }), {
      minLength: real.length,
      maxLength: real.length,
    }),
    fc.integer(),
  )
  .map(([flags, seed]) => {
    const weeks = real.flatMap((w, i) => {
      const f = flags[i]!;
      if (f.drop) return [];
      return [{ ...w, wAvg: f.nullAvg ? null : w.wAvg, histMin: f.nullBand ? null : w.histMin, histMax: f.nullBand ? null : w.histMax }];
    });
    const shuffled = [...weeks].sort((a, b) => ((day(a.weekStart) * 2654435761 + seed) % 97) - ((day(b.weekStart) * 2654435761 + seed) % 97));
    return shuffled;
  });

const levelArb = fc.constantFrom("high", "moderate", "low", "not_detected", "unknown") as fc.Arbitrary<Activity>;

describe("UI-6 timeline", () => {
  it("UI-6.1 real history yields a populated, unbroken line and band", () => {
    const m = buildTimeline({ weeks: real, markers: [], virus: "fluA", locationName: "Toronto", size: SIZE });
    expect(m.empty).toBe(false);
    expect(m.line.flat().length).toBeGreaterThan(0);
    expect(m.domain.endWeek).toBe(real[real.length - 1]!.weekStart);
  });

  it("UI-6.10 empty input is empty and says so", () => {
    const m = buildTimeline({ weeks: [], markers: [], virus: "rsv", locationName: "Ottawa", size: SIZE });
    expect(m.empty).toBe(true);
    expect(m.line).toEqual([]);
    expect(m.summary).toContain("no measured history");
  });

  it("Property 8 UI-6.1 UI-6.2 UI-6.3 UI-6.4 UI-6.6 UI-17.5: only measured weeks, gaps kept, nothing past the latest week", () => {
    fc.assert(
      fc.property(inputArb, fc.array(fc.record({ i: fc.nat(), activityIndex: levelArb }), { maxLength: 2 }), (weeks, mk) => {
        const markers = mk.map((m) => ({ weekStart: real[m.i % real.length]!.weekStart, activityIndex: m.activityIndex }));
        const model = buildTimeline({ weeks, markers, virus: "fluA", locationName: "Toronto", size: SIZE });
        const byWeek = new Map(weeks.map((w) => [w.weekStart, w]));
        const maxInput = [...weeks.map((w) => w.weekStart), ...markers.map((m) => m.weekStart)].sort().pop() ?? "";

        for (const run of model.line) {
          for (const p of run) {
            expect(byWeek.get(p.weekStart)?.wAvg).toBe(p.wAvg);
            expect(p.weekStart <= maxInput).toBe(true);
            expect(p.x).toBeLessThanOrEqual(SIZE.w + 1e-9);
          }
          for (let i = 1; i < run.length; i++) expect(day(run[i]!.weekStart) - day(run[i - 1]!.weekStart)).toBe(7);
        }
        for (const run of model.band) {
          for (const b of run) {
            const w = byWeek.get(b.weekStart)!;
            expect(w.histMin).not.toBeNull();
            expect(w.histMax).not.toBeNull();
            expect(b.weekStart <= maxInput).toBe(true);
          }
          for (let i = 1; i < run.length; i++) expect(day(run[i]!.weekStart) - day(run[i - 1]!.weekStart)).toBe(7);
        }

        // gapWeeks = null + missing weeks between first and last supplied week.
        const sorted = [...byWeek.keys()].sort();
        const expected: string[] = [];
        if (sorted.length) {
          for (let d = day(sorted[0]!); d <= day(sorted[sorted.length - 1]!); d += 7) {
            const iso = new Date(d * 86_400_000).toISOString().slice(0, 10);
            const w = byWeek.get(iso);
            if (!w || w.wAvg === null) expected.push(iso);
          }
        }
        expect(model.gapWeeks).toEqual(expected);

        // Markers only for supplied weeks, never beyond the domain.
        expect(new Set(model.markers.map((m) => m.weekStart))).toEqual(new Set(markers.map((m) => m.weekStart)));
        for (const m of model.markers) expect(m.weekStart <= maxInput).toBe(true);
        if (model.domain.endWeek) expect(model.domain.endWeek).toBe(maxInput);
        // Plotted points are order independent.
        const again = buildTimeline({ weeks: [...weeks].reverse(), markers, virus: "fluA", locationName: "Toronto", size: SIZE });
        expect(again.line).toEqual(model.line);
      }),
    );
  });

  it("Property 9 UI-6.5 UI-6.7 UI-6.8: text is complete, dated and never converts concentration", () => {
    fc.assert(
      fc.property(inputArb, (weeks) => {
        const model = buildTimeline({ weeks, markers: [], virus: "fluA", locationName: "Toronto", size: SIZE });
        const texts = [model.summary, model.bandLabel, model.yAxisTitle, ...model.rows.map((r) => r.tooltip)];
        for (const t of texts) {
          expect(checkWording(t).passed).toBe(true);
          expect(t).not.toMatch(/\b(people|cases|risk|infected)\b/i);
        }
        expect(model.summary).toContain("Flu A");
        expect(model.summary).toContain("Toronto");
        if (weeks.length) {
          expect(model.summary).toContain(`${model.gapWeeks.length} gap`);
          const latest = [...weeks].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)).find((w) => w.wAvg !== null);
          if (latest) {
            expect(model.summary).toContain(String(latest.wAvg));
            expect(model.summary).toContain("week of");
          }
        }
        for (const r of model.rows) {
          expect(r.tooltip).toContain("week of");
          expect(r.tooltip).toContain(r.wAvg === null ? "not published" : String(r.wAvg));
          if (r.histMin !== null) expect(r.tooltip).toContain(String(r.histMin));
          if (r.histMax !== null) expect(r.tooltip).toContain(String(r.histMax));
        }
      }),
    );
  });
});
