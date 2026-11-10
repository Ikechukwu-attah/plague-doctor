/**
 * "About this status" explanations (UI-19.20) and recent-weeks strip copy (UI-19.21).
 *
 * Built only from definitions already in the repo: the methods copy
 * (NA1/NA2, missing vs zero, two classifications), the limitation sentence in
 * `states`, and the PHAC technical-notes facts recorded in docs/BUILD_PLAN.md
 * (trend uses the previous 5 weeks; the activity index needs 12 months of data).
 *
 * Known gap: the numeric thresholds behind High / Moderate / Low are not in the
 * repo's PHAC-sourced copy, so they are not stated here. The text points to
 * PHAC's own technical notes instead of inventing them.
 */
import { MISSING_VS_ZERO, NA1_DEFINITION, NA2_DEFINITION, METHODS_SOURCES, TWO_CLASSIFICATIONS } from "./methods";
import { limitation } from "./states";
import { weekOf } from "./timing";
import type { ProvenanceField } from "../lib/view/provenance";

export type StatusTopicId = "levels" | "trend" | "sample_weeks" | "unknowns" | "community";

export interface StatusTopic {
  id: StatusTopicId;
  heading: string;
  body: readonly string[];
}

const TECHNICAL_NOTES_URL = METHODS_SOURCES.find((s) => s.label === "Technical notes")?.url ?? "";

export const STATUS_EXPLAINER_TITLE = "About this status";
export const STATUS_EXPLAINER_SOURCE_LABEL = "PHAC technical notes";
export const STATUS_EXPLAINER_SOURCE_URL = TECHNICAL_NOTES_URL;

export const STATUS_TOPICS: readonly StatusTopic[] = [
  {
    id: "levels",
    heading: "What High, Moderate and Low mean",
    body: [
      "These are PHAC's own activity categories for a place and virus. Plague Doctor shows them as PHAC publishes them and does not re-classify them.",
      TWO_CLASSIFICATIONS,
      "The cut-offs between categories are defined by PHAC in its technical notes.",
    ],
  },
  {
    id: "trend",
    heading: "How the trend is defined",
    body: [
      "The trend is PHAC's. It is worked out by PHAC's method from the previous 5 weeks, and PHAC reports it as Increasing, No Change (shown here as Stable) or Decreasing.",
      "Plague Doctor does not calculate its own trend.",
    ],
  },
  {
    id: "sample_weeks",
    heading: "Why places can show different weeks",
    body: [
      "Each place shows the latest sample week PHAC published for it, so two places can show different weeks.",
      "Plague Doctor does not line the weeks up or fill them in. Read the week of date next to each value.",
    ],
  },
  {
    id: "unknowns",
    heading: "No data and missing weeks",
    body: [
      NA1_DEFINITION,
      NA2_DEFINITION,
      "A week with no published sample is a gap in the history.",
      MISSING_VS_ZERO,
    ],
  },
  {
    id: "community",
    heading: "A community signal, not a personal chance",
    body: [limitation()],
  },
];

/** Which topics to show next to each provenance "i" field. */
const TOPICS_FOR_FIELD: Record<ProvenanceField, readonly StatusTopicId[]> = {
  Viral_Activity_Level: ["levels", "unknowns", "community"],
  latestLevel: ["levels", "unknowns", "community"],
  latestTrend: ["trend", "unknowns", "community"],
  weekStart: ["sample_weeks", "unknowns", "community"],
};

export function topicsForField(field: ProvenanceField): StatusTopic[] {
  const ids = TOPICS_FOR_FIELD[field];
  return STATUS_TOPICS.filter((t) => ids.includes(t.id));
}

// Recent PHAC weeks strip (UI-19.21)
export const RECENT_WEEKS_HEADING = "Recent PHAC weeks";
export const RECENT_WEEKS_MISSING = "no sample published for this week";
export const RECENT_WEEKS_NOTE =
  "Weeks with no published sample are shown as gaps. They are not filled in and they are not zero.";

export function recentWeekMeasured(s: { week: string; value: number }): string {
  return `${weekOf(s.week)}: ${s.value} (PHAC units)`;
}

export function recentWeekMissing(s: { week: string }): string {
  return `${weekOf(s.week)}: ${RECENT_WEEKS_MISSING}`;
}

export function recentWeeksSummary(s: { count: number; endWeek: string; measured: number; missing: number }): string {
  return (
    `Last ${s.count} PHAC weeks, ending in the ${weekOf(s.endWeek)}: ` +
    `${s.measured} with a measurement, ${s.missing} with no sample published.`
  );
}
