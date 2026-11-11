/**
 * Places table sort (UI-20.21, Property 33; supersedes UI-19.15 to UI-19.17).
 * Orders by PHAC's own values only; no score is computed. Rows with no value for the active column
 * (unknown level, no data, no monitoring site, no sample week, unknown trend) come last in BOTH
 * directions, A–Z. Ties fall back to A–Z, then locationId, so the order is total and stable.
 *
 * Ascending means: name/province A–Z; level lowest PHAC category first; trend Decreasing to Increasing;
 * sample week oldest first; freshness freshest first. Descending reverses the known values only.
 */
import type { LandingRow } from "./landing-rows";
import { DEFAULT_SORT, type ListSort } from "./sort-spec";

export { DEFAULT_SORT };
export type { ListSort };

const LEVEL_VALUE: Record<string, number> = { not_detected: 0, low: 1, moderate: 2, high: 3 };
const TREND_VALUE: Record<string, number> = { decreasing: 0, stable: 1, increasing: 2 };
const FRESH_VALUE: Record<string, number> = { latest_available: 0, delayed: 1, outdated: 2 };

function levelValue(row: LandingRow): number | undefined {
  if (row.noSite || row.badge.kind !== "level") return undefined;
  return LEVEL_VALUE[row.badge.activity];
}

function trendValue(row: LandingRow): number | undefined {
  if (row.noSite || row.badge.kind !== "level") return undefined;
  return TREND_VALUE[row.trend];
}

function az(a: LandingRow, b: LandingRow): number {
  return (
    a.location.locationName.localeCompare(b.location.locationName) ||
    a.location.locationId.localeCompare(b.location.locationId)
  );
}

function cmpNum(a: number, b: number): number {
  return a - b;
}

/** Returns the comparable value for a row, or undefined when the row has none for this column. */
function valueOf(row: LandingRow, key: ListSort["key"]): number | string | undefined {
  switch (key) {
    case "name":
      return row.location.locationName;
    case "province":
      return row.location.province;
    case "level":
      return levelValue(row);
    case "trend":
      return trendValue(row);
    case "week":
      return row.noSite ? undefined : row.weekStart;
    case "freshness":
      return row.noSite ? undefined : FRESH_VALUE[row.freshness];
  }
}

function cmpValue(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return cmpNum(a, b);
  return String(a).localeCompare(String(b));
}

/** Returns a new array; the input is not mutated. */
export function sortRows(rows: readonly LandingRow[], sort: ListSort = DEFAULT_SORT): LandingRow[] {
  const sign = sort.dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = valueOf(a, sort.key);
    const vb = valueOf(b, sort.key);
    if (va === undefined || vb === undefined) {
      if (va === undefined && vb === undefined) return az(a, b);
      return va === undefined ? 1 : -1;
    }
    return sign * cmpValue(va, vb) || az(a, b);
  });
}
