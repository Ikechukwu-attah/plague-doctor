/**
 * Screen-state and shell copy (UI-2, UI-12).
 */
import { weekOf } from "./timing";

export const LANDING_HEADING = "What's in the water?";

/** One-line limitation statement (UI-2.1). */
export function limitation(): string {
  return "Weekly wastewater observations published by the Public Health Agency of Canada. A community signal, not your personal chance of getting sick.";
}

export const NO_LOCATIONS = "No locations in this snapshot";
export const NO_MATCHING_LOCATIONS = "No matching locations";

export function staleBanner(s: { week: string }): string {
  return `Showing last verified data from ${weekOf(s.week)}`;
}

export function loadFailed(s: { resource: string }): string {
  return `Couldn't load ${s.resource}`;
}

export const RETRY = "Retry";
export const SKIP_TO_CONTENT = "Skip to content";
export const SHOW_MAP = "Show map";
export const HIDE_MAP = "Hide map";
export const NAV = { map: "Map", plan: "Plan a gathering", methods: "Behind the mask" } as const;

export const NOT_FOUND = "We couldn't find that location in this snapshot.";
export const HISTORY_ONLY = "History only";
export const SHOW_ALL_HISTORY = "Show all history";

export const THREE_CLOCKS = {
  sampleWeek: "Sample week",
  phacFileUpdated: "PHAC file updated",
  lastIngest: "Our last successful ingest",
  unavailable: "unavailable",
} as const;

export function stateAnnouncement(s: { what: string }): string {
  return `${s.what} updated`;
}

export const LOADING_LABEL = "Loading";

/** Route error boundary (design: Error Handling, "Unexpected render error"). No stack or internals. */
export const ERROR_HEADING = "Something went wrong";
export function routeError(s: { area: string }): string {
  return `Something went wrong while showing ${s.area}. Try again, or return to the map.`;
}
export const PAGE_NOT_FOUND = "We couldn't find that page";
export const BACK_TO_MAP = "Back to the map";

/** Human name of the failing area for a pathname. */
export function errorArea(pathname: string | null | undefined): string {
  const p = pathname ?? "/";
  if (p.startsWith("/city")) return "the city page";
  if (p.startsWith("/plan")) return "the gathering planner";
  if (p.startsWith("/card")) return "the Omen Card";
  if (p.startsWith("/methods")) return "Behind the mask";
  return "the map";
}
