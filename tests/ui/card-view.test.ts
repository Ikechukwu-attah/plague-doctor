import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildCardView } from "@/lib/view/card-view";
import { PREVENTION_CHECKLIST } from "@/evidence/copy/checklist";
import type { NearStatement } from "@/evidence/card-types";
import { levelLabel } from "@/ui-copy/levels";
import { addDays, allStrings, cardArb, history, makeCard, OTTAWA, TODAY, TORONTO } from "./card-helpers";

const LEVEL_WORDS = /\b(high|moderate|low|not detected)\b/i;

describe("Property 13: card views contain claims only appropriate to their timing state", () => {
  // Feature: interactive-surveillance-ui, Property 13: Card views contain claims only appropriate to their timing state
  it("UI-9.2 UI-9.3 UI-9.4 UI-9.5 UI-9.6 UI-9.16 timing-appropriate claims", () => {
    fc.assert(
      fc.property(cardArb, (card) => {
        const v = buildCardView(card, TODAY);
        expect(v.timing).toBe(card.timingState);
        expect(v.header.caveat).toBe("community wastewater, not your chance of getting sick");
        expect(v.header.place).toBe(card.locationName);
        expect(v.header.eventDate).toBe(card.eventDate);
        expect(v.header.createdAt).toBe(card.createdAt);
        expect(v.header.setting.length).toBeGreaterThan(0);
        expect(card.preventionChecklist).toBe(PREVENTION_CHECKLIST);
        if (v.timing === "near") {
          const stmts = card.statements as NearStatement[];
          v.rows.forEach((r, i) => {
            const s = stmts[i]!;
            expect(r.pathogen).toBe(s.pathogen);
            if (s.activityIndex === "unknown") expect(r.badge.kind).toBe("unknown");
            else expect(r.badge.kind === "level" && r.badge.word).toBe(levelLabel(s.activityIndex));
          });
          if (stmts.some((s) => s.weekStart)) expect(v.observedStrip).toContain("week of ");
        } else {
          for (const r of v.rows) {
            expect(r.label).toBe("past observations, not a prediction");
            expect("activity" in r).toBe(false);
          }
          if (v.timing === "too_early") {
            expect(v.headline.toLowerCase()).toContain("too early to know");
            expect(v.sentence.toLowerCase()).toContain("too early to know");
            const text = allStrings({ ...v, header: undefined }).join(" ");
            expect(text).not.toMatch(LEVEL_WORDS);
            expect(JSON.stringify(v.rows)).not.toContain("as of");
          }
        }
        expect(allStrings(v).join(" ")).not.toMatch(/\blive\b/i);
      }),
      { numRuns: 150 },
    );
  });

  it("Ottawa near card labels the Ontario aggregate and names no other city", () => {
    const v = buildCardView(makeCard({ loc: OTTAWA, offsetDays: 3, setting: "indoor.family-dinner", attendees: [] }), TODAY);
    expect(v.timing).toBe("near");
    if (v.timing !== "near") return;
    expect(v.regionalNotice).toContain("Ontario");
    expect(v.rows.every((r) => r.regionLabel?.includes("Ontario"))).toBe(true);
  });
});

describe("P2 end to end: past card shows that year's wAvg (EVD-3.7, UI-9.5, 18.6)", () => {
  it("buildCardView past row carries the event year's own wAvg and week", () => {
    const rows = history().filter((w) => w.pathogen === "fluA" && w.wAvg !== null);
    const week = rows[rows.length - 60]!;
    const offset = Math.round(
      (Date.parse(week.weekStart + "T12:00:00Z") - Date.parse(TODAY + "T12:00:00Z")) / 86400000,
    );
    const card = makeCard({ loc: TORONTO, offsetDays: offset, setting: "indoor.celebration", attendees: [] });
    expect(card.eventDate).toBe(addDays(TODAY, offset));
    const v = buildCardView(card, TODAY);
    expect(v.timing).toBe("past");
    if (v.timing !== "past") return;
    const row = v.rows.find((r) => r.pathogen === "fluA")!;
    expect(row.wAvg).toBe(week.wAvg);
    expect(row.weekStart).toBe(week.weekStart);
    expect(row.gap).toBe(false);
  });
});
