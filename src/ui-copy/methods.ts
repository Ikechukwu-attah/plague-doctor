/**
 * Behind the Mask copy (UI-11). Static prose; dynamic facts come from the API.
 * URLs are PHAC sources recorded in docs/BUILD_PLAN.md (verified 2026-10-31).
 */
import { AGGREGATE_SOURCE_URL, TREND_SOURCE_URL } from "../evidence/copy/sources";
import { PREVENTION_CHECKLIST } from "../evidence/copy/checklist";

export interface SourceLink {
  label: string;
  url: string;
}

export const METHODS_SOURCES: readonly SourceLink[] = [
  { label: "PHAC wastewater dashboard", url: "https://health-infobase.canada.ca/wastewater/" },
  { label: "Trend file (wastewater_trend.csv)", url: TREND_SOURCE_URL },
  { label: "History file (wastewater_aggregate.csv)", url: AGGREGATE_SOURCE_URL },
  {
    label: "Data dictionary",
    url: "https://health-infobase.canada.ca/src/data/covidLive/wastewater/covid19-wastewater-data-dictionary-en.csv",
  },
  { label: "Technical notes", url: "https://health-infobase.canada.ca/wastewater/technical-notes.html" },
  { label: "Protective measures", url: PREVENTION_CHECKLIST.sourceUrl },
];

export const NA1_DEFINITION =
  "NA1: a newly onboarded site with under 12 months of data, awaiting a baseline.";
export const NA2_DEFINITION =
  "NA2: a site that stopped sampling, has no recent data, or is not being sampled.";

export const TWO_CLASSIFICATIONS =
  "PHAC publishes two classifications. The activity index is the headline value. The signal level is a separate, secondary value. Plague Doctor shows PHAC's values unchanged and never mixes the two in one element.";

export const LIMITS_HEADING = "What wastewater cannot tell you";
export const LIMITS: readonly string[] = [
  "Whether any one person is infected.",
  "How many people are ill.",
  "Hospitalizations or other clinical outcomes.",
  "Conditions on a future date.",
];

export const EDUCATIONAL_STATEMENT =
  "Plague Doctor is an educational project that uses data published by the Public Health Agency of Canada. It is not affiliated with the Public Health Agency of Canada or the Government of Canada, and implies no endorsement by either.";

/** Data attribution (UI-11.1, UI-11.7): parts so the link can be rendered inline. */
export interface DataAttributionParts {
  before: string;
  linkText: string;
  href: string;
  after: string;
}

export const DATA_ATTRIBUTION: DataAttributionParts = {
  before:
    "Data: Wastewater monitoring dashboard: Respiratory virus activity, Public Health Agency of Canada. Reproduced from ",
  linkText: "health-infobase.canada.ca/wastewater",
  href: "https://health-infobase.canada.ca/wastewater/",
  after: "; not an official version and not affiliated with PHAC.",
};

export function dataAttributionText(p: DataAttributionParts = DATA_ATTRIBUTION): string {
  return `${p.before}${p.linkText}${p.after}`;
}

export const MISSING_VS_ZERO =
  "Missing data is not zero, and Not detected is not the absence of disease.";

export const HISTORY_BAND_EXPLAINER =
  "Historical minimum and maximum values are the extremes PHAC recorded for that week of the year. They are not a typical range, a confidence interval or a projection.";

export const SECTION_HEADINGS = {
  sources: "Sources",
  clocks: "Three clocks",
  definitions: "Definitions",
  coverage: "Coverage in this snapshot",
  limits: LIMITS_HEADING,
  freshness: "Freshness convention",
  about: "About this project",
} as const;

export function schemaVersionLine(s: { version: string }): string {
  return `Schema version in use: ${s.version}`;
}

export function snapshotIdLine(s: { snapshotId: string }): string {
  return `Latest snapshot ID: ${s.snapshotId}`;
}

export function coverageFacts(s: { locations: number; discontinued: number }): string {
  return `This snapshot lists ${s.locations} locations, ${s.discontinued} of them marked discontinued or without recent data.`;
}

export function ingestionFailure(s: { detail: string; lastValidWeek: string }): string {
  return `The latest ingestion failed: ${s.detail}. Last valid sample week: ${s.lastValidWeek}.`;
}
