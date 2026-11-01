/**
 * Core normalized types for Plague Doctor.
 * These mirror the source exactly — no re-classification happens here.
 * All values come from PHAC CSVs verbatim (BUILD_PLAN §6).
 */

export type Pathogen = "covid19" | "fluA" | "fluB" | "rsv";

export type Activity =
  | "high"
  | "moderate"
  | "low"
  | "not_detected"
  | "unknown";

export type UnknownReason =
  | "na1_new_site" // PHAC NA1: < 12 months data, awaiting baseline
  | "na2_not_sampling" // PHAC NA2: stopped sampling / no recent data / not sampled
  | "no_recent_data" // latestTrend = "No Recent Data"
  | "aggregate_below_coverage" // no aggregate row: < 50% pop (< 75% national)
  | "missing_row"
  | "parse_error";

export type Direction = "increasing" | "stable" | "decreasing" | "unknown";

/**
 * A single observation from a trend snapshot — latest week only, per PHAC.
 * ING-5: activityIndex maps Viral_Activity_Level; signalLevel maps latestLevel.
 * Never mix the two in a single UI element.
 */
export interface StatusObservation {
  snapshotId: string;
  locationId: string;
  grouping: "site" | "city" | "province" | "national";
  pathogen: Pathogen;
  weekStart: string; // ISO date YYYY-MM-DD (EpiWeek Sunday)
  activityIndex: Activity; // headline: Viral_Activity_Level
  unknownReason?: UnknownReason; // only when activityIndex = "unknown"
  signalLevel: Activity; // secondary: latestLevel
  trend: Direction; // latestTrend
  interpretationMethod: "publisher"; // always PHAC's classification, not ours
  sourceUrl: string;
  // Raw PHAC location name for display
  locationName: string;
  city: string;
  province: string;
  pruid: string;
  // Schema version used to parse this record
  schemaVersion: string;
}

/**
 * A measured week from the aggregate file.
 * No official level or trend — only measured concentration + historical band.
 * histMin/histMax are extremes across all recorded EpiWeeks, NOT confidence intervals.
 */
export interface MeasuredWeek {
  snapshotId: string;
  locationId: string;
  locationName: string;
  pathogen: Pathogen;
  epiYear: number;
  epiWeek: number;
  weekStart: string; // ISO date YYYY-MM-DD
  wAvg: number | null;
  histMin: number | null;
  histMax: number | null;
  populationCoverage: number | null;
}

/**
 * Metadata for a stored source file snapshot.
 * snapshotId = sha256 hex of raw file bytes.
 */
export interface SourceSnapshot {
  snapshotId: string;
  sourceUrl: string;
  fetchedAt: string; // ISO timestamp
  lastModified?: string; // from HTTP response header
  etag?: string; // from HTTP response header
  origin: "live" | "wayback";
  archivedAt?: string; // Wayback capture timestamp (never the sample date)
  schemaVersion: string;
  rowCount: number;
  rejectedRows: number;
  status: "valid" | "rejected";
}

/**
 * Coverage status for a location in the API response.
 */
export type CoverageStatus =
  | "city_site" // has a direct city-level row
  | "site_only" // only site-level rows, no city aggregate
  | "no_city_site" // no coverage; province aggregate may be available
  | "province_aggregate" // province-level row
  | "national"; // Canada-level row

/**
 * Location entry returned by /api/locations
 */
export interface LocationEntry {
  locationId: string;
  locationName: string;
  city: string;
  province: string;
  pruid: string;
  grouping: "site" | "city" | "province" | "national";
  coverage: CoverageStatus;
  provinceAggregate?: LocationEntry; // offered when coverage = no_city_site
}

/**
 * Response envelope — every API response includes these fields.
 */
export interface ApiEnvelope<T> {
  snapshotId: string;
  sampleWeek: string; // most recent weekStart in the payload
  sourceUrl: string;
  data: T;
}
