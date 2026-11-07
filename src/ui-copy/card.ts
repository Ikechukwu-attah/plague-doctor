/**
 * Omen Card, saved-event and diff copy (UI-9, UI-10, UI-14).
 * Checklist items are NOT here; they come only from src/evidence/copy/checklist.ts.
 */
import type { Pathogen } from "../evidence/types";
import { formatDisplayDate } from "../evidence/date-utils";
import { VIRUS_LABEL } from "./levels";
import { weekOf } from "./timing";

/** Required on every card rendering (UI-9.6). */
export const COMMUNITY_CAVEAT = "community wastewater, not your chance of getting sick";

export function caveatSentence(): string {
  return `This is ${COMMUNITY_CAVEAT}.`;
}

export const NOT_CONDITIONS_ON_DATE = "not conditions on your date";

/** Required label for historical context (UI-9.5). */
export const PAST_OBSERVATIONS_LABEL = "past observations, not a prediction";

export function notDetectedNote(): string {
  return "Not detected is not a guarantee that nobody in the community is infected.";
}

export const NO_RECENT_DATA = "No recent data";

export const CHECKLIST_HEADING = "Ways to reduce the spread";

export function checklistSource(s: { reviewedOn: string }): string {
  return `Source: Public Health Agency of Canada, reviewed ${formatDisplayDate(s.reviewedOn)}.`;
}

export function cardTitle(s: { kind: string; place: string }): string {
  return `${s.kind} in ${s.place}`;
}

export function createdAt(s: { date: string }): string {
  return `Card created ${formatDisplayDate(s.date)}`;
}

export const SHARE_DATED_SNAPSHOT = "This text is a dated snapshot of PHAC's observations.";
export const COPY_SHARE_TEXT = "Copy share text";
export const COPIED_CONFIRMATION = "Share text copied";
export const COPY_FAILED = "Copying failed. Select the text below and copy it.";

export const ATTENDEES_ON_SCREEN_NOTE =
  "Shown on this screen only. Not included in the link, the share text or any request.";

/** Historical band statement; values are PHAC units, shown unconverted. */
export function historicalBand(s: {
  virus: Pathogen;
  place: string;
  min: number | null;
  max: number | null;
}): string {
  const virus = VIRUS_LABEL[s.virus];
  if (s.min == null || s.max == null) {
    return `${virus} in ${s.place}: no past observations for that week of the year.`;
  }
  return `${virus} in ${s.place}: lowest and highest weekly values ever recorded for that week of the year (PHAC units) ${s.min.toFixed(2)} to ${s.max.toFixed(2)}, ${PAST_OBSERVATIONS_LABEL}.`;
}

export function historicalMeasured(s: {
  virus: Pathogen;
  place: string;
  week: string;
  wAvg: number;
}): string {
  return `${VIRUS_LABEL[s.virus]} in ${s.place}: measured weekly average ${s.wAvg.toFixed(2)} (PHAC units) in the ${weekOf(s.week)}.`;
}

export function historicalGap(s: { virus: Pathogen; place: string }): string {
  return `${VIRUS_LABEL[s.virus]} in ${s.place}: no measurement for that week.`;
}

export const HISTORICAL_BAND_NOTE =
  "The lowest and highest values are extremes recorded for that week of the year. They are not a typical range or a confidence interval.";

// Saved events (UI-10)
export const SAVE_TO_DEVICE = "Save to this device";
export const KEEP_ATTENDEES = "Also keep who is attending on this device";
export const DELETE_SAVED = "Delete saved event";
export const DELETE_ALL_SAVED = "Delete all saved events";
export const SAVE_FAILED = "This event could not be saved. Your card is still on screen.";
export const SAVED_UNREADABLE = "This saved event could not be read";
export const SAVED_CONFIRMATION = "Saved to this device";

export const NO_NEWER_SNAPSHOT = "No newer snapshot is available";
export const DIFF_UNCHANGED = "No change in PHAC's latest classifications since your saved card";

export function diffChanged(s: { oldValue: string; newValue: string }): string {
  return `newer observation: ${s.oldValue} → ${s.newValue}`;
}

export const DIFF_REVISED = "revised";
export const DIFF_NEWLY_MISSING = "no longer reported";
export const DIFF_UNCHANGED_ENTRY = "unchanged";

export function baselineOnly(s: { snapshotId: string; createdAt: string }): string {
  return `Showing your saved card from snapshot ${s.snapshotId}, created ${formatDisplayDate(s.createdAt.slice(0, 10))}.`;
}

// Omen Card screen chrome (UI-9, UI-10)
export const OMEN_CARD_LABEL = "Omen Card";
export const SHARE_HEADING = "Share text preview";
export const NO_ATTENDEES_IN_SHARE = "No attendee details included";
export const SHARE_TEXT_FIELD_LABEL = "Share text";
export const SAVED_HEADING = "Saved on this device";
export const SAVED_NONE = "Nothing is saved on this device.";
export const SAVED_UNAVAILABLE = "Saving is not available in this browser.";
export const OPEN_SAVED = "Open";
export const EDIT_GATHERING = "Edit gathering";
export const SEE_WHAT_CHANGED = "See what changed";
export const HIDE_CHANGES = "Hide changes";
export const CHANGES_HEADING = "Changes since your saved card";
export const CARD_LINK_INVALID = "This card link is not valid.";
export const SAVED_NOT_FOUND = "That saved event is not on this device.";
export const CARD_LOADING_LABEL = "Preparing your card";
export const SOURCE_LINE = "Source: PHAC National Wastewater Monitoring";

export function savedOn(s: { date: string }): string {
  return `Saved ${formatDisplayDate(s.date)}`;
}

export function savedItemTitle(s: { place: string; date: string }): string {
  return `${s.place}, ${formatDisplayDate(s.date)}`;
}

export function diffWeeks(s: { baseline?: string; current?: string }): string {
  const a = s.baseline ? weekOf(s.baseline) : "no sample week";
  const b = s.current ? weekOf(s.current) : "no sample week";
  return `Saved card: ${a}. Newer file: ${b}.`;
}

export function diffSnapshots(s: { baseline?: string; current?: string }): string {
  return `snapshots ${s.baseline ?? "unavailable"} → ${s.current ?? "unavailable"}`;
}
