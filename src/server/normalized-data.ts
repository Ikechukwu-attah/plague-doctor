/**
 * Read normalized JSON data from disk.
 * These are read-only helpers for the API route handlers.
 * No DB, no network — pure file reads.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type {
  StatusObservation,
  MeasuredWeek,
  SourceSnapshot,
  LocationEntry,
  CoverageStatus,
} from "@/evidence/types";
import { GAZETTEER, lookupCity } from "@/server/geo/cities";

const NORMALIZED_DIR = join(process.cwd(), "data", "normalized");

export function readTrendLatest(): StatusObservation[] {
  const path = join(NORMALIZED_DIR, "trend-latest.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8")) as StatusObservation[];
}

export function readIndex(): SourceSnapshot[] {
  const path = join(NORMALIZED_DIR, "index.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8")) as SourceSnapshot[];
}

export function readHistory(
  locationId: string,
  pathogen: string
): MeasuredWeek[] {
  const path = join(
    NORMALIZED_DIR,
    "history",
    `${locationId}-${pathogen}.json`
  );
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8")) as MeasuredWeek[];
}

/**
 * Derive the latest snapshotId and sampleWeek from a list of observations.
 */
export function latestMeta(observations: StatusObservation[]): {
  snapshotId: string;
  sampleWeek: string;
  sourceUrl: string;
} {
  if (observations.length === 0) {
    return { snapshotId: "", sampleWeek: "", sourceUrl: "" };
  }
  const sorted = [...observations].sort((a, b) =>
    b.weekStart.localeCompare(a.weekStart)
  );
  const first = sorted[0]!;
  return {
    snapshotId: first.snapshotId,
    sampleWeek: first.weekStart,
    sourceUrl: first.sourceUrl,
  };
}

// ---------------------------------------------------------------------------
// Province aggregate lookup helpers
// ---------------------------------------------------------------------------

/**
 * Build a map from province name → first province-grouping observation.
 */
function buildProvinceMap(
  observations: StatusObservation[]
): Map<string, StatusObservation> {
  const map = new Map<string, StatusObservation>();
  for (const obs of observations) {
    if (obs.grouping === "province" && !map.has(obs.province)) {
      map.set(obs.province, obs);
    }
  }
  return map;
}

function provinceAggregateEntry(obs: StatusObservation): LocationEntry {
  return {
    locationId: obs.locationId,
    locationName: obs.locationName,
    city: obs.city,
    province: obs.province,
    pruid: obs.pruid,
    grouping: "province",
    coverage: "province_aggregate",
  };
}

function deriveCoverage(groupings: Set<string>): CoverageStatus {
  if (groupings.has("national")) return "national";
  if (groupings.has("province")) return "province_aggregate";
  if (groupings.has("city")) return "city_site";
  if (groupings.has("site")) return "site_only";
  return "no_city_site";
}

function bestGrouping(groupings: Set<string>): LocationEntry["grouping"] {
  if (groupings.has("city")) return "city";
  if (groupings.has("site")) return "site";
  if (groupings.has("province")) return "province";
  return "national";
}

// ---------------------------------------------------------------------------
// Derive all locations (ING-8 / ING-11 / ING-12)
// ---------------------------------------------------------------------------

/**
 * Derive all locations from trend observations, augmented with gazetteer cities.
 * Coverage is computed from the snapshot — never hardcoded.
 *
 * @param observations  All StatusObservation records from the latest snapshot
 * @param search        Optional case-insensitive substring filter (ING-12)
 */
export function deriveLocations(
  observations: StatusObservation[],
  search?: string
): LocationEntry[] {
  const provinceMap = buildProvinceMap(observations);

  // --- Collect locations present in PHAC data ---
  const byId = new Map<
    string,
    {
      locationId: string;
      locationName: string;
      city: string;
      province: string;
      pruid: string;
      groupings: Set<string>;
    }
  >();

  for (const obs of observations) {
    const existing = byId.get(obs.locationId);
    if (existing) {
      existing.groupings.add(obs.grouping);
    } else {
      byId.set(obs.locationId, {
        locationId: obs.locationId,
        locationName: obs.locationName,
        city: obs.city,
        province: obs.province,
        pruid: obs.pruid,
        groupings: new Set([obs.grouping]),
      });
    }
  }

  const phacEntries: LocationEntry[] = [];
  for (const [, loc] of byId) {
    const coverage = deriveCoverage(loc.groupings);
    const entry: LocationEntry = {
      locationId: loc.locationId,
      locationName: loc.locationName,
      city: loc.city,
      province: loc.province,
      pruid: loc.pruid,
      grouping: bestGrouping(loc.groupings),
      coverage,
    };
    if (coverage === "no_city_site") {
      const provObs = provinceMap.get(loc.province);
      if (provObs) entry.provinceAggregate = provinceAggregateEntry(provObs);
    }
    phacEntries.push(entry);
  }

  // --- Add gazetteer-only cities (ING-11) ---
  const gazetteeerEntries: LocationEntry[] = [];
  for (const [slug, city] of GAZETTEER) {
    if (!byId.has(slug)) {
      const provObs = provinceMap.get(city.province);
      const entry: LocationEntry = {
        locationId: slug,
        locationName: city.cityName,
        city: city.cityName,
        province: city.province,
        pruid: city.pruid,
        grouping: "city",
        coverage: "no_city_site",
        ...(provObs ? { provinceAggregate: provinceAggregateEntry(provObs) } : {}),
      };
      gazetteeerEntries.push(entry);
    }
  }

  const all = [...phacEntries, ...gazetteeerEntries].sort((a, b) =>
    a.locationName.localeCompare(b.locationName)
  );

  // --- Search filter (ING-12) ---
  if (!search || search.trim() === "") return all;
  const q = search.trim().toLowerCase();
  return all.filter(
    (l) =>
      l.locationName.toLowerCase().includes(q) ||
      l.city.toLowerCase().includes(q) ||
      l.province.toLowerCase().includes(q)
  );
}

// ---------------------------------------------------------------------------
// Resolve a single locationId (ING-11 / ING-8)
// ---------------------------------------------------------------------------

/**
 * Resolve a locationId → LocationEntry.
 * 1. Check PHAC data first.
 * 2. Fall back to gazetteer (ING-11: no-site cities return 200, not 404).
 * 3. Return null only if neither knows the slug (→ 404).
 */
export function resolveLocation(
  locationId: string,
  observations: StatusObservation[]
): LocationEntry | null {
  const provinceMap = buildProvinceMap(observations);

  // Check PHAC observations
  const obsForId = observations.filter((o) => o.locationId === locationId);
  if (obsForId.length > 0) {
    const first = obsForId[0]!;
    const groupings = new Set(obsForId.map((o) => o.grouping));
    const coverage = deriveCoverage(groupings);
    const entry: LocationEntry = {
      locationId,
      locationName: first.locationName,
      city: first.city,
      province: first.province,
      pruid: first.pruid,
      grouping: bestGrouping(groupings),
      coverage,
    };
    if (coverage === "no_city_site") {
      const provObs = provinceMap.get(first.province);
      if (provObs) entry.provinceAggregate = provinceAggregateEntry(provObs);
    }
    return entry;
  }

  // Fall back to gazetteer
  const city = lookupCity(locationId);
  if (!city) return null;

  const provObs = provinceMap.get(city.province);
  return {
    locationId,
    locationName: city.cityName,
    city: city.cityName,
    province: city.province,
    pruid: city.pruid,
    grouping: "city",
    coverage: "no_city_site",
    ...(provObs ? { provinceAggregate: provinceAggregateEntry(provObs) } : {}),
  };
}
