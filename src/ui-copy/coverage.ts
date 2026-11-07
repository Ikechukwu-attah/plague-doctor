/**
 * Coverage copy (UI-4.4, UI-5.5–5.8, UI-8.10, UI-9.7).
 * Never substitutes another city's values; provincial aggregates are labelled.
 */

export const NO_MONITORING_SITE = "No monitoring site";

export function noCitySite(s: { place: string }): string {
  return `PHAC has no monitoring site for ${s.place} in this snapshot.`;
}

export function provincialAggregateNotice(s: { place: string; region: string }): string {
  return `Showing PHAC's ${s.region} provincial aggregate, not ${s.place}.`;
}

export function noAggregate(s: { place: string }): string {
  return `No PHAC provincial aggregate is available for ${s.place}.`;
}

export function regionalLabel(s: { region: string }): string {
  return `${s.region} provincial aggregate (PHAC)`;
}

export const SITE_ONLY_NOTICE = "This location has monitoring sites but no city-level classification.";

export const SHOW_DISCONTINUED = "Show discontinued sites";

export const AGGREGATE_COVERAGE_RULE =
  "PHAC publishes aggregates only at 50% population coverage or more (75% nationally). A missing aggregate is a coverage gap, not a result of Not detected.";
