/**
 * Level, trend and virus labels (UI-1.4, UI-1.6, UI-14.2).
 * Words mirror PHAC values verbatim; "unknown" is always "No data", never a level.
 */
import type { Activity, Direction, Pathogen } from "../evidence/types";
import { weekOf } from "./timing";

export const VIRUS_LABEL: Record<Pathogen, string> = {
  covid19: "COVID-19",
  fluA: "Flu A",
  fluB: "Flu B",
  rsv: "RSV",
};

export const LEVEL_LABEL: Record<Activity, string> = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
  not_detected: "Not detected",
  unknown: "No data",
};

export const TREND_LABEL: Record<Direction, string> = {
  increasing: "Increasing",
  stable: "Stable",
  decreasing: "Decreasing",
  unknown: "Unknown",
};

const TREND_PHRASE: Record<Direction, string> = {
  increasing: "increasing",
  stable: "stable",
  decreasing: "decreasing",
  unknown: "trend unknown",
};

export function virusLabel(p: Pathogen): string {
  return VIRUS_LABEL[p];
}

export function levelLabel(a: Activity): string {
  return LEVEL_LABEL[a];
}

export function trendLabel(d: Direction): string {
  return TREND_LABEL[d];
}

export interface ObservationSlots {
  virus: Pathogen;
  place: string;
  level: Activity;
  trend: Direction;
  /** ISO date of the EpiWeek Sunday. */
  week: string;
}

/** Headline statement for one measurement: location, virus, PHAC class, week of {date}. */
export function observation(s: ObservationSlots): string {
  const virus = VIRUS_LABEL[s.virus];
  if (s.level === "unknown") {
    return `${virus} in ${s.place}'s wastewater: ${LEVEL_LABEL.unknown} for the ${weekOf(s.week)}.`;
  }
  return `${virus} in ${s.place}'s wastewater was ${LEVEL_LABEL[s.level]} in the ${weekOf(s.week)}, and ${TREND_PHRASE[s.trend]}.`;
}

/** Accessible name for a map marker or list row (UI-3.6). */
export function markerName(s: ObservationSlots): string {
  const virus = VIRUS_LABEL[s.virus];
  const level = LEVEL_LABEL[s.level];
  return `${s.place}, ${virus}: ${level}, ${TREND_LABEL[s.trend]}, ${weekOf(s.week)}`;
}
