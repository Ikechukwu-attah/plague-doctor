/**
 * Places table sort state and its URL encoding (UI-20.21, UI-20.22, Property 33).
 * Pure and dependency-free so url-state.ts can import it. Public values only.
 *
 * URL: `sort=<key>` is ascending, `sort=<key>:desc` is descending. The default (name, ascending) is never written.
 * The legacy value `sort=activity` (Highest activity first) is read as `level:desc`.
 */
export const SORT_KEYS = ["name", "province", "level", "trend", "week", "freshness"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export interface ListSort {
  key: SortKey;
  dir: SortDir;
}

export const DEFAULT_SORT: ListSort = { key: "name", dir: "asc" };

export type SortParam = SortKey | `${SortKey}:desc`;

/** Every value the `sort` parameter may carry (besides the legacy `activity`). */
export const SORT_PARAMS: readonly SortParam[] = SORT_KEYS.flatMap(
  (k): SortParam[] => [k, `${k}:desc`],
);

export const LEGACY_SORT_ACTIVITY = "activity";

/** True for every value the `sort` parameter may carry, including the legacy `activity`. */
export function isAcceptedSortValue(v: string): boolean {
  return v === LEGACY_SORT_ACTIVITY || (SORT_PARAMS as readonly string[]).includes(v);
}

export function isDefaultSort(s: ListSort): boolean {
  return s.key === DEFAULT_SORT.key && s.dir === DEFAULT_SORT.dir;
}

/** The value to write to the URL, or undefined for the default order. */
export function sortToParam(s: ListSort): SortParam | undefined {
  if (isDefaultSort(s)) return undefined;
  return s.dir === "desc" ? `${s.key}:desc` : s.key;
}

/** Parses a (validated) `sort` parameter value; anything else is the default order. */
export function sortFromParam(v: string | undefined): ListSort {
  if (v === LEGACY_SORT_ACTIVITY) return { key: "level", dir: "desc" };
  if (v === undefined) return DEFAULT_SORT;
  const [k, d] = v.split(":");
  const key = SORT_KEYS.find((x) => x === k);
  if (!key) return DEFAULT_SORT;
  return { key, dir: d === "desc" ? "desc" : "asc" };
}

/** Header click: a new column starts ascending; the active column toggles. */
export function nextSort(current: ListSort, key: SortKey): ListSort {
  if (current.key !== key) return { key, dir: "asc" };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}
