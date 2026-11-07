/**
 * UI copy templates — UI-1.10, UI-9.12, UI-14.1–14.5, UI-14.6.
 * Property 18: Every user-facing template passes the wording guard and carries its required slots.
 * Slot values come from real PHAC fixture names and dates (never arbitrary strings).
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { checkWording } from "../../src/evidence/wording-guard";
import { PREVENTION_CHECKLIST } from "../../src/evidence/copy/checklist";
import * as copy from "../../src/ui-copy";
import { loadTrendFixture, isoDateArb, observationArb, pathogenArb, activityArb } from "./helpers";
import type { Direction } from "../../src/evidence/types";

const directionArb = fc.constantFrom<Direction>("increasing", "stable", "decreasing", "unknown");
const BANNED_OUT = [/sampled on/i, /\bsafe\b/i, /\bforecast/i, /\blive\b/i];

function expectClean(text: string): void {
  const r = checkWording(text);
  expect(r.violations, text).toEqual([]);
  for (const re of BANNED_OUT) expect(text, text).not.toMatch(re);
}

/** Week starts must be real dates; Sundays are not required for formatting. */
describe("UI-14.5 P18 measurement templates", () => {
  it("observation() carries place, virus, classification and week of {date}", () => {
    fc.assert(
      fc.property(observationArb(), directionArb, activityArb, (obs, trend, level) => {
        const text = copy.observation({
          virus: obs.pathogen,
          place: obs.locationName,
          level,
          trend,
          week: obs.weekStart,
        });
        expectClean(text);
        expect(text).toContain(obs.locationName);
        expect(text).toContain(copy.virusLabel(obs.pathogen));
        expect(text).toContain(copy.levelLabel(level));
        expect(text).toContain(copy.weekOf(obs.weekStart));
      }),
      { numRuns: 200 },
    );
  });

  it("markerName() carries location, virus, classification and week of {date}", () => {
    fc.assert(
      fc.property(observationArb(), (obs) => {
        const text = copy.markerName({
          virus: obs.pathogen,
          place: obs.locationName,
          level: obs.activityIndex,
          trend: obs.trend,
          week: obs.weekStart,
        });
        expectClean(text);
        expect(text).toContain(obs.locationName);
        expect(text).toContain(copy.virusLabel(obs.pathogen));
        expect(text).toContain(copy.levelLabel(obs.activityIndex));
        expect(text).toContain("week of ");
      }),
    );
  });

  it("unknown level is never worded as a level", () => {
    const obs = loadTrendFixture()[0]!;
    const text = copy.observation({
      virus: obs.pathogen,
      place: obs.locationName,
      level: "unknown",
      trend: "unknown",
      week: obs.weekStart,
    });
    expect(text).toContain("No data");
    expect(text).not.toMatch(/\b(low|not detected|high|moderate)\b/i);
  });

  it("weekOf() is the only producer of 'week of' in date templates", () => {
    fc.assert(
      fc.property(isoDateArb, (d) => {
        expect(copy.weekOf(d)).toMatch(/^week of [A-Z]/);
        expect(copy.observedStrip({ week: d })).toContain(copy.weekOf(d));
        expect(copy.asOfNotOnDate({ week: d })).toContain(copy.weekOf(d));
        expect(copy.staleBanner({ week: d })).toContain(copy.weekOf(d));
      }),
    );
  });
});

describe("UI-14 P18 timing, card, coverage and state templates", () => {
  it("date templates pass the guard and carry required phrases", () => {
    fc.assert(
      fc.property(isoDateArb, (d) => {
        const tooEarly = copy.tooEarly({ date: d });
        expectClean(tooEarly);
        expect(tooEarly).toMatch(/^It's too early to know what will be circulating on /);
        const strip = copy.observedStrip({ week: d });
        expectClean(strip);
        expect(strip).toContain("not conditions on your date");
        expectClean(copy.asOfNotOnDate({ week: d }));
        for (const s of ["too_early", "near", "past"] as const) {
          expectClean(copy.timingRule(s, { latestWeek: d }));
          expectClean(copy.timingRule(s));
        }
        expectClean(copy.guideQuote("stale", { week: d }));
        expectClean(copy.baselineOnly({ snapshotId: "a".repeat(64), createdAt: `${d}T12:00:00.000Z` }));
      }),
    );
  });

  it("static strings and place-slot templates pass the guard", () => {
    const places = [...new Set(loadTrendFixture().flatMap((o) => [o.locationName, o.city, o.province]))].filter(Boolean);
    const strings: string[] = [
      copy.caveatSentence(),
      copy.COMMUNITY_CAVEAT,
      copy.NOT_CONDITIONS_ON_DATE,
      copy.PAST_OBSERVATIONS_LABEL,
      copy.notDetectedNote(),
      copy.NO_RECENT_DATA,
      copy.CHECKLIST_HEADING,
      copy.SHARE_DATED_SNAPSHOT,
      copy.ATTENDEES_ON_SCREEN_NOTE,
      copy.HISTORICAL_BAND_NOTE,
      copy.NO_NEWER_SNAPSHOT,
      copy.DIFF_UNCHANGED,
      copy.SAVE_FAILED,
      copy.SAVED_UNREADABLE,
      copy.diffChanged({ oldValue: "Moderate", newValue: "High" }),
      copy.limitation(),
      copy.NO_LOCATIONS,
      copy.NO_MATCHING_LOCATIONS,
      copy.NOT_FOUND,
      copy.WHO_PRIVACY_NOTE,
      copy.TOO_EARLY_SHORT,
      copy.DELAYED_CAUTION,
      copy.OUTDATED_HISTORY_ONLY,
      copy.FRESHNESS_CONVENTION,
      copy.AGGREGATE_COVERAGE_RULE,
      copy.SITE_ONLY_NOTICE,
      copy.UNKNOWN_NO_REASON,
      ...copy.UNKNOWN_REASONS.map(copy.unknownReason),
      ...(["landing", "stale", "tooEarly", "unknown", "card"] as const).map((k) => copy.guideQuote(k)),
    ];
    for (const place of places) {
      strings.push(
        copy.noCitySite({ place }),
        copy.noAggregate({ place }),
        copy.provincialAggregateNotice({ place, region: "Ontario" }),
        copy.regionalLabel({ region: place }),
        copy.cardTitle({ kind: "Family dinner", place }),
        copy.loadFailed({ resource: "locations" }),
      );
    }
    for (const s of strings) expectClean(s);
  });

  it("historical templates carry the required label and PHAC units, no conversion", () => {
    fc.assert(
      fc.property(
        pathogenArb,
        observationArb(),
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        (virus, obs, a, b) => {
          const band = copy.historicalBand({ virus, place: obs.locationName, min: Math.min(a, b), max: Math.max(a, b) });
          expectClean(band);
          expect(band).toContain(obs.locationName);
          expect(band).toContain(copy.virusLabel(virus));
          expect(band).toContain(copy.PAST_OBSERVATIONS_LABEL);
          const measured = copy.historicalMeasured({ virus, place: obs.locationName, week: obs.weekStart, wAvg: a });
          expectClean(measured);
          expect(measured).toContain(copy.weekOf(obs.weekStart));
          expectClean(copy.historicalBand({ virus, place: obs.locationName, min: null, max: null }));
          expectClean(copy.historicalGap({ virus, place: obs.locationName }));
        },
      ),
    );
  });

  it("freshness, level and trend labels match the spec words", () => {
    expect(["latest_available", "delayed", "outdated", "no_data"].map((k) => copy.freshnessLabel(k as never))).toEqual([
      "Latest available",
      "Delayed",
      "Outdated",
      "No data",
    ]);
    expect(copy.levelLabel("unknown")).toBe("No data");
    expect(copy.levelLabel("not_detected")).toBe("Not detected");
    expect(copy.trendLabel("stable")).toBe("Stable");
  });

  it("caveat and design examples match UI-9.6 and C10", () => {
    expect(copy.caveatSentence().toLowerCase()).toContain("community wastewater, not your chance of getting sick");
    expect(copy.notDetectedNote()).toBe("Not detected is not a guarantee that nobody in the community is infected.");
    expect(copy.notDetectedNote()).not.toMatch(/no infections/i);
    expect(copy.tooEarly({ date: "2026-12-21" })).toBe(
      "It's too early to know what will be circulating on Dec 21, 2026.",
    );
    expect(copy.unknownReason("na1_new_site")).toBe("Newly onboarded site, under 12 months of data, awaiting baseline.");
    expect(copy.unknownReason("na2_not_sampling")).toBe(
      "Site stopped sampling, has no recent data, or is not being sampled.",
    );
  });
});

describe("UI-14 P18 methods and planner copy", () => {
  it("methods prose passes the guard and states the required facts", () => {
    const strings = [
      copy.NA1_DEFINITION,
      copy.NA2_DEFINITION,
      copy.TWO_CLASSIFICATIONS,
      ...copy.LIMITS,
      copy.EDUCATIONAL_STATEMENT,
      copy.MISSING_VS_ZERO,
      copy.HISTORY_BAND_EXPLAINER,
      copy.coverageFacts({ locations: 3, discontinued: 1 }),
      copy.ingestionFailure({ detail: "schema mismatch", lastValidWeek: "week of Oct 18, 2026" }),
      ...Object.values(copy.SECTION_HEADINGS),
    ];
    for (const s of strings) expectClean(s);
    expect(copy.EDUCATIONAL_STATEMENT).toMatch(/not affiliated with the Public Health Agency of Canada/);
    expect(copy.AGGREGATE_COVERAGE_RULE).toMatch(/50%/);
    expect(copy.AGGREGATE_COVERAGE_RULE).toMatch(/75%/);
    expect(copy.METHODS_SOURCES).toHaveLength(6);
    for (const s of copy.METHODS_SOURCES) expect(s.url).toMatch(/^https:\/\//);
  });

  it("planner lists are fixed and settings use fixed labels (C13)", () => {
    expect(copy.ATTENDEE_CATEGORIES).toEqual(["older adults", "infants", "immunocompromised"]);
    for (const v of copy.VENUES) {
      for (const k of copy.KINDS) {
        const label = copy.settingLabel(v.id, k.id);
        expect(label).toBe(`${v.label} · ${k.label}`);
        expectClean(label);
      }
    }
    for (const step of copy.PLANNER_STEPS) expectClean(copy.confirmDisabledReason({ missing: step }));
    expect(copy.isVenueId("indoor")).toBe(true);
    expect(copy.isKindId("free text")).toBe(false);
  });

  it("checklist copy is sourced only from the evidence module", () => {
    expect(copy.checklistSource({ reviewedOn: PREVENTION_CHECKLIST.reviewedOn })).toContain("Public Health Agency of Canada");
    expect(copy.METHODS_SOURCES.map((s) => s.url)).toContain(PREVENTION_CHECKLIST.sourceUrl);
    const src = readdirSync(join(process.cwd(), "src/ui-copy"))
      .map((f) => readFileSync(join(process.cwd(), "src/ui-copy", f), "utf8"))
      .join("\n");
    for (const item of PREVENTION_CHECKLIST.items) expect(src).not.toContain(item);
  });
});

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("UI-1.12 UI-14.1 static scans", () => {
  const EMOJI = /\p{Emoji_Presentation}|\uFE0F/u;

  it("no emoji in src/ui-copy/** or src/components/**", () => {
    const files = [...walk(join(process.cwd(), "src/ui-copy")), ...walk(join(process.cwd(), "src/components"))].filter(
      (f) => /\.(ts|tsx|css)$/.test(f),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(EMOJI);
  });

  it("src/components/** has no health sentence literals (only ui-copy imports)", () => {
    const files = walk(join(process.cwd(), "src/components")).filter((f) => /\.tsx?$/.test(f));
    const HEALTH = /wastewater|week of|infect|\bsick\b|disease|outbreak|circulating|prediction|not detected/i;
    const LITERAL = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
    for (const f of files) {
      const code = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/^\s*import .*$/gm, "");
      for (const m of code.matchAll(LITERAL)) {
        expect(m[2], `${f}: ${m[0]}`).not.toMatch(HEALTH);
      }
    }
  });
});
