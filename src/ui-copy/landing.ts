/**
 * Landing page copy (UI-2, UI-3, UI-4, UI-5.9, UI-13.7).
 * Components render these strings and never author their own sentences.
 */
import type { Activity, Pathogen } from "../evidence/types";
import { LEVEL_LABEL, VIRUS_LABEL } from "./levels";
import { NO_MONITORING_SITE } from "./coverage";
import { weekOf } from "./timing";

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

export const SORT_LABEL = "Sort list";

/** Map-only toggle (UI-19.18): places with no data or no monitoring site stay in the list either way. */
export const SHOW_NO_DATA_PLACES = "Show places without data";
export const SORT_AZ = "A–Z";
export const SORT_ACTIVITY = "Highest activity first";
export const SORT_ACTIVITY_NOTE = "Ordered by PHAC's activity level. Places without data come last.";

/** Live-region message after the list order changes. */
export function sortAnnouncement(s: { sort: "az" | "activity" }): string {
  return `City list sorted ${s.sort === "activity" ? "by highest activity first" : "A to Z"}`;
}

export const CLUSTER_CLOSE = "Close list";
export const CLUSTER_HINT = "These places are too close together to tell apart on the map at this size.";

/** Accessible name of a cluster marker. */
export function clusterLabel(s: { count: number; selected?: boolean }): string {
  return s.selected ? `${s.count} places, includes the ${SELECTED} place` : `${s.count} places`;
}

/** Accessible name of the chooser opened by a cluster marker. */
export function clusterChooserLabel(s: { count: number }): string {
  return `${s.count} places on the map`;
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
