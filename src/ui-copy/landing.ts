/**
 * Landing page copy (UI-2, UI-3, UI-4, UI-5.9, UI-13.7).
 * Components render these strings and never author their own sentences.
 */
import type { Activity, Pathogen } from "../evidence/types";
import { LEVEL_LABEL, VIRUS_LABEL } from "./levels";
import { NO_MONITORING_SITE } from "./coverage";
import { weekOf } from "./timing";
import type { ListSort, SortDir, SortKey } from "../lib/view/sort-spec";

export const VIRUS_GROUP_LABEL = "Virus";
export const FIND_CITY_LABEL = "Find a city";
export const FIND_CITY_PLACEHOLDER = "Toronto, Halifax…";
export const SKIP_MAP = "Skip map to city list";
export const CITY_LIST_LABEL = "Cities";
export const LEGEND_LABEL = "Map legend";
export const LEGEND_SENTENCE = "Fog shows PHAC's activity level. It is not your risk.";
export const CLOSE_DETAILS = "Close details";
export const PLAN_A_GATHERING = "Plan a gathering";
export const OPEN_FULL_PAGE = "Open full page";
export const SELECTED = "selected";
export const SEARCHING = "Searching…";

/** Map-only toggle (UI-19.18): places with no data or no monitoring site stay in the table either way. */
export const SHOW_NO_DATA_PLACES = "Show places without data";

/** Places table (UI-20.19 to UI-20.28). */
export const PLACES_HEADING = "All places";
export const PLACES_CAPTION = "All places. Column headers sort the table.";
export const NOT_AVAILABLE = "not available";
export const PLACES_COLUMN_LABEL: Record<SortKey, string> = {
  name: "City",
  province: "Province",
  level: "PHAC level",
  trend: "Trend",
  week: "Sample week",
  freshness: "Freshness",
};

/** What "ascending" and "descending" mean for each column, for the live region. */
const SORT_ORDER_WORDS: Record<SortKey, Record<SortDir, string>> = {
  name: { asc: "A to Z", desc: "Z to A" },
  province: { asc: "A to Z", desc: "Z to A" },
  level: { asc: "lowest first", desc: "highest first" },
  trend: { asc: "decreasing first", desc: "increasing first" },
  week: { asc: "oldest first", desc: "newest first" },
  freshness: { asc: "latest available first", desc: "outdated first" },
};

/** Live-region message after the table order changes, e.g. "Sorted by PHAC level, highest first". */
export function sortedBy(s: ListSort): string {
  return `Sorted by ${PLACES_COLUMN_LABEL[s.key]}, ${SORT_ORDER_WORDS[s.key][s.dir]}`;
}

export function browseAsList(s: { count: number }): string {
  return `Browse as list · ${s.count}`;
}

export function detailsLabel(s: { place: string }): string {
  return `${s.place} details`;
}

export function mapLabel(s: { virus: Pathogen; week?: string }): string {
  const virus = VIRUS_LABEL[s.virus];
  return s.week
    ? `Map of Canadian wastewater monitoring locations, ${virus}, ${weekOf(s.week)}`
    : `Map of Canadian wastewater monitoring locations, ${virus}`;
}

export interface MapCounts {
  total: number;
  byActivity: Record<Activity, number>;
  noSite: number;
}

/** Visually hidden text alternative for the map (UI-13.7): counts per PHAC level. */
export function mapTextAlternative(s: { virus: Pathogen; week?: string; counts: MapCounts }): string {
  const order: Activity[] = ["high", "moderate", "low", "not_detected", "unknown"];
  const parts = order.map((a) => `${LEVEL_LABEL[a]} ${s.counts.byActivity[a]}`);
  parts.push(`${NO_MONITORING_SITE} ${s.counts.noSite}`);
  const head = s.week
    ? `${s.counts.total} locations, ${VIRUS_LABEL[s.virus]}, ${weekOf(s.week)}.`
    : `${s.counts.total} locations, ${VIRUS_LABEL[s.virus]}.`;
  return `${head} ${parts.join(", ")}. The city list below has the same information.`;
}
