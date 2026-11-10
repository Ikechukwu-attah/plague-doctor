/**
 * UI-19.8 to UI-19.11: reviewed city → PHAC regional location table.
 *
 * NOT an evidence module. A row exists only where PHAC's own location name or
 * its published site list covers the city. No guessing: a city without a row
 * keeps "No monitoring site" and the provincial-aggregate offer.
 *
 * Reviewed against data/normalized/trend-latest.json (week of 2026-10-25).
 * Candidates considered and NOT added, because PHAC's location name and site
 * list do not name the city: Mississauga and Brampton (PHAC "Peel Region",
 * site "Peel G.E. Booth"), Sydney (PHAC "Cape Breton Regional Municipality").
 */
import type { StatusObservation } from "@/evidence/types";
import type { RegionalSiteInfo } from "@/lib/api/location-types";

export interface RegionalSiteRow {
  /** Gazetteer slug of the city. */
  cityId: string;
  cityName: string;
  province: string;
  /** PHAC locationId (a `city`-grouping location in the snapshot). */
  targetLocationId: string;
  /** Non-empty: PHAC source URL and the data field that covers the city. */
  citation: string;
}

const TREND_URL = "https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv";

export const REGIONAL_SITE_TABLE: readonly RegionalSiteRow[] = [
  {
    cityId: "vancouver",
    cityName: "Vancouver",
    province: "British Columbia",
    targetLocationId: "metro-vancouver",
    citation: `${TREND_URL}: city-level location "Metro Vancouver" (British Columbia); its PHAC site rows are named "Vancouver …" (Iona Island, Lions Gate, Lulu Island, Annacis Island).`,
  },
];

export interface RegionalResolution {
  row: RegionalSiteRow;
  info: RegionalSiteInfo;
}

/**
 * Resolve a city id to its reviewed regional PHAC location, or null.
 * Requires a row in the table AND a city-grouping target in the snapshot.
 */
export function resolveRegionalSite(
  cityId: string,
  observations: readonly StatusObservation[],
  table: readonly RegionalSiteRow[] = REGIONAL_SITE_TABLE,
): RegionalResolution | null {
  const row = table.find((r) => r.cityId === cityId);
  if (!row || row.citation.trim() === "") return null;
  const targetObs = observations.find(
    (o) => o.locationId === row.targetLocationId && o.grouping === "city" && o.province === row.province,
  );
  if (!targetObs) return null;
  const prefix = `${row.cityName} `;
  const names = new Set<string>();
  for (const o of observations) {
    if (o.grouping !== "site" || o.city !== targetObs.city || o.province !== targetObs.province) continue;
    names.add(o.locationName.startsWith(prefix) ? o.locationName.slice(prefix.length) : o.locationName);
  }
  return {
    row,
    info: {
      targetLocationId: targetObs.locationId,
      targetName: targetObs.locationName,
      citation: row.citation,
      siteNames: [...names].sort((a, b) => a.localeCompare(b)),
    },
  };
}
