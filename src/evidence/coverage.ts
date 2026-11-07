/**
 * Coverage resolver — EVD-2.
 * Determines coverage type for a locationId from snapshot observations.
 * Pure function; never throws; does no I/O; never caches.
 *
 * isGazetteerCity is injected by the caller (who calls lookupCity from
 * src/server/geo/cities.ts) so this module stays free of I/O.
 */
import type { StatusObservation } from "./types";
import type { CoverageResult } from "./card-types";

/**
 * Resolve coverage type for a locationId.
 *
 * 1. Filter observations by locationId.
 * 2. Any grouping "city" → city_site
 * 3. Only grouping "site" → site_only
 * 4. grouping "province"/"national" rows have their own locationId → map accordingly
 * 5. No rows + isGazetteerCity true → no_city_site (+ province aggregate by pruid, else aggregate_below_coverage)
 * 6. No rows + isGazetteerCity false → unknown (API 404)
 * 7. Unexpected → unknown
 */
export function resolveCoverage(
  locationId: string,
  observations: StatusObservation[],
  isGazetteerCity: boolean,
  pruid?: string,
): CoverageResult {
  if (!locationId) return { coverage: "unknown" };

  const forLocation = observations.filter((o) => o.locationId === locationId);

  if (forLocation.length > 0) {
    const groupings = new Set(forLocation.map((o) => o.grouping));
    if (groupings.has("city")) return { coverage: "city_site" };
    if (groupings.has("site")) return { coverage: "site_only" };
    if (groupings.has("national")) return { coverage: "national" };
    if (groupings.has("province")) return { coverage: "city_site" };
  }

  if (isGazetteerCity) {
    if (pruid) {
      const provinceObs = observations.find(
        (o) => o.grouping === "province" && o.pruid === pruid,
      );
      if (provinceObs) return { coverage: "no_city_site", regional: provinceObs };
    }
    return { coverage: "no_city_site", unknownReason: "aggregate_below_coverage" };
  }

  return { coverage: "unknown" };
}
