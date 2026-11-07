/**
 * Shared UI test helpers (UI-17.1, UI-17.10).
 * Fixtures are real PHAC bytes (fixtures/*.real.csv) parsed through the
 * production parsers; arbitraries are `synthetic`.
 */
import { readFileSync } from "fs";
import { join } from "path";
import * as fc from "fast-check";
import { parseTrend } from "../../src/server/ingest/parse-trend";
import { parseAggregate } from "../../src/server/ingest/parse-aggregate";
import { TREND_SOURCE_URL, AGGREGATE_SOURCE_URL } from "../../src/evidence/copy/sources";
import { PathogenSchema, ActivitySchema } from "../../src/evidence/schemas";
import type { StatusObservation, MeasuredWeek, Pathogen } from "../../src/evidence/types";

export const FIXTURE_SNAPSHOT_ID = "0".repeat(64);

/** Strip tags and entities from rendered HTML and collapse whitespace. */
export function textOf(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function fixture(name: string): Buffer {
  return readFileSync(join(process.cwd(), "fixtures", name));
}

let trendCache: StatusObservation[] | undefined;
let aggregateCache: MeasuredWeek[] | undefined;

/** Real PHAC trend fixture (Oct 2026 schema) via production parser. */
export function loadTrendFixture(): StatusObservation[] {
  trendCache ??= parseTrend(
    fixture("trend-oct-2026.real.csv"),
    "trend-oct-2026",
    FIXTURE_SNAPSHOT_ID,
    TREND_SOURCE_URL,
  ).observations;
  return trendCache;
}

/** Real PHAC aggregate fixture via production parser. */
export function loadAggregateFixture(): MeasuredWeek[] {
  aggregateCache ??= parseAggregate(
    fixture("aggregate-oct-2026.real.csv"),
    FIXTURE_SNAPSHOT_ID,
    AGGREGATE_SOURCE_URL,
  ).weeks;
  return aggregateCache;
}

/** Arbitrary pathogen (synthetic). */
export const pathogenArb: fc.Arbitrary<Pathogen> = fc.constantFrom(
  ...PathogenSchema.options,
);

/** Arbitrary PHAC activity level incl. unknown (synthetic). */
export const activityArb: fc.Arbitrary<(typeof ActivitySchema.options)[number]> =
  fc.constantFrom(...ActivitySchema.options);

/** Arbitrary real calendar date as YYYY-MM-DD (synthetic). */
export const isoDateArb: fc.Arbitrary<string> = fc
  .date({ min: new Date("2020-01-01T12:00:00Z"), max: new Date("2030-12-31T12:00:00Z"), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));

/** Arbitrary observation from the real trend fixture. */
export function observationArb(): fc.Arbitrary<StatusObservation> {
  return fc.constantFrom(...loadTrendFixture());
}

/** Arbitrary week from the real aggregate fixture. */
export function measuredWeekArb(): fc.Arbitrary<MeasuredWeek> {
  return fc.constantFrom(...loadAggregateFixture());
}
