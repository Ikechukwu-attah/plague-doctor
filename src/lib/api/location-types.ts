/**
 * API-layer location types (UI-19.8). `regional_site` is additive and lives
 * outside src/evidence: the evidence engine keeps its own CoverageStatus, and
 * the view layer maps a regional site to `city_site` when building cards.
 */
import type { CoverageStatus, LocationEntry } from "@/evidence/types";

export type ApiCoverage = CoverageStatus | "regional_site";

/** Why a city resolves to a PHAC regional location (all fields come from the reviewed table + snapshot). */
export interface RegionalSiteInfo {
  /** PHAC locationId whose values are shown for the city. */
  targetLocationId: string;
  /** PHAC's own name for that location, e.g. "Metro Vancouver". */
  targetName: string;
  /** Reviewed source for the table row (PHAC URL / data field). */
  citation: string;
  /** Plant names derived from the snapshot's site rows for the target. */
  siteNames: string[];
}

export interface ApiLocationEntry extends Omit<LocationEntry, "coverage"> {
  coverage: ApiCoverage;
  /** Present only when coverage = regional_site. */
  regional?: RegionalSiteInfo;
}
