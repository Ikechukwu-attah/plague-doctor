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

// Regional site (UI-19.8 to UI-19.11)
export const REGIONAL_SITE_LABEL = "Regional site";
export const REGIONAL_SITE_INFO_OPEN = "About regional sites";
export const REGIONAL_SITE_INFO_CLOSE = "Close";
export const REGIONAL_SITE_INFO_TITLE = "Regional site";
export const REGIONAL_SITE_INFO_BODY =
  "PHAC reports this location for the area its wastewater plants serve. That catchment is not the same as the city boundary, and it can include or leave out neighbourhoods. The values shown are PHAC's for that regional location.";
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
/** Built from data: the site names come from the snapshot's site rows. */
export function regionalCoverageSentence(s: { place: string; region: string; siteNames: readonly string[] }): string {
  const plants = s.siteNames.length > 0 ? ` (${joinNames(s.siteNames)} plants)` : "";
  return `${s.place} is covered by PHAC's ${s.region} site${plants}.`;
}
