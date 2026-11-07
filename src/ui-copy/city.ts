/**
 * City page, timeline and provenance copy (UI-5, UI-6, UI-7).
 * Components import every visible string from here.
 */
import type { Pathogen } from "../evidence/types";
import { formatDisplayDate } from "../evidence/date-utils";
import { VIRUS_LABEL } from "./levels";
import { weekOf } from "./timing";

export const CITY_HEADLINE_LABEL = "PHAC viral activity level";
export const CITY_SIGNAL_LABEL = "PHAC signal level";
export const CITY_TREND_LABEL = "PHAC trend";
export const CITY_VIRUS_LIST_LABEL = "Viruses";
export const CITY_VIRUS_CHOOSER_LABEL = "Virus for the timeline";
export const CITY_CLOSE = "Close";
export const CITY_BACK_TO_MAP = "Back to map";
export const CITY_SITES_HEADING = "Monitoring sites in this city";
export const CITY_SITES_NOTE = "Each site is reported by PHAC on its own.";
export const CITY_NOT_FOUND_ACTION = "Return to the map";

export function cityObservedLine(s: { week: string }): string {
  return `Observed: ${weekOf(s.week)}`;
}
export function cityDrawerLabel(s: { place: string }): string {
  return `Details for ${s.place}`;
}

// Regional toggle (UI-5.6, UI-5.7)
export const SHOW_REGIONAL = "Show the provincial aggregate";
export const HIDE_REGIONAL = "Hide the provincial aggregate";

// Timeline (UI-6)
export function timelineHeading(s: { virus: Pathogen }): string {
  return `${VIRUS_LABEL[s.virus]} measured history`;
}
export const TIMELINE_LOADING = "Loading measured history";
export const TIMELINE_EMPTY = "No measured history is published for this location and virus.";
export const TIMELINE_WINDOW_DEFAULT = "Showing the most recent 52 weeks.";
export const TIMELINE_WINDOW_ALL = "Showing all published history.";
export const TIMELINE_SHOW_RECENT = "Show recent 52 weeks";
export const TIMELINE_LEGEND_LINE = "Measured weekly average";
export const TIMELINE_LEGEND_GAP = "Week with no measurement (a gap, not zero)";
export const TIMELINE_LEGEND_MARKER = "Official PHAC level for that week";
export const TIMELINE_TABLE_SUMMARY = "Show the data as a table";
export const TIMELINE_TABLE_WEEK = "Week";
export const TIMELINE_TABLE_VALUE = "Measured weekly average";
export const TIMELINE_TABLE_MIN = "Historical minimum";
export const TIMELINE_TABLE_MAX = "Historical maximum";
export const TIMELINE_NOT_PUBLISHED = "not published";
export function timelineChartLabel(s: { virus: Pathogen; place: string }): string {
  return `Line chart of ${VIRUS_LABEL[s.virus]} measured weekly averages for ${s.place}. Use Tab to move between weeks.`;
}
export function timelineAxisDate(s: { date: string }): string {
  return formatDisplayDate(s.date);
}

// Provenance (UI-7)
export const PROVENANCE_OPEN = "Where does this come from?";
export function provenanceOpenFor(s: { statement: string }): string {
  return `Where does this come from? ${s.statement}`;
}
export const PROVENANCE_TITLE = "Where this comes from";
export const PROVENANCE_CLOSE = "Close";
export const PROVENANCE_FIELDS = {
  snapshotId: "Snapshot ID",
  field: "PHAC field",
  locationId: "Location ID",
  grouping: "Grouping",
  ruleId: "Rule",
  interpretation: "Interpretation",
  source: "Source file",
} as const;
export const PROVENANCE_ATTRIBUTION = "The classification shown here is PHAC's. Plague Doctor does not re-classify it.";
