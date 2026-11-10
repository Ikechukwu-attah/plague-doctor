/**
 * City list sort (UI-19.15, UI-19.16, UI-19.17).
 * Orders by PHAC's own activity category only; no score is computed. Unknown, no data and
 * no monitoring site come last. Ties fall back to A–Z, then locationId, so the order is stable.
 */
import type { LandingRow } from "./landing-rows";

export type ListSort = "az" | "activity";
export const DEFAULT_SORT: ListSort = "az";

const RANK: Record<string, number> = { high: 0, moderate: 1, low: 2, not_detected: 3 };
const LAST = 4;

function rankOf(row: LandingRow): number {
  if (row.noSite || row.badge.kind !== "level") return LAST;
  return RANK[row.badge.activity] ?? LAST;
}

function az(a: LandingRow, b: LandingRow): number {
  return (
    a.location.locationName.localeCompare(b.location.locationName) ||
    a.location.locationId.localeCompare(b.location.locationId)
  );
}

/** Returns a new array; the input is not mutated. */
export function sortRows(rows: readonly LandingRow[], sort: ListSort): LandingRow[] {
  const out = [...rows];
  if (sort === "activity") out.sort((a, b) => rankOf(a) - rankOf(b) || az(a, b));
  else out.sort(az);
  return out;
}
