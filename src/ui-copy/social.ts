/**
 * Social preview and card image copy (UI-19.30 to UI-19.32, doc item 16.12).
 * Static text only: no place names, no dates, no measurements.
 */
import { formatDisplayDate } from "../evidence/date-utils";
import { PLANNER_HEADING, PLANNER_INTRO } from "./planner";
import { SHARE_DATED_SNAPSHOT, caveatSentence } from "./card";
import { limitation } from "./states";

export const SOCIAL_SITE_NAME = "Plague Doctor";
export const SOCIAL_TAGLINE = "Wastewater signals, not forecasts";
export const SOCIAL_IMAGE_ALT = "Plague Doctor: wastewater signals, not forecasts";

export const SOCIAL_DEFAULT_TITLE = "Plague Doctor — Canadian Wastewater Respiratory Virus Explorer";
export const SOCIAL_DEFAULT_DESCRIPTION =
  "Educational public-health surveillance and event-planning app. Data: PHAC National Wastewater Monitoring.";

export interface SocialCopy {
  title: string;
  description: string;
}

export const SOCIAL_HOME: SocialCopy = {
  title: "What's in the water? — Plague Doctor",
  description: limitation(),
};
export const SOCIAL_PLAN: SocialCopy = {
  title: `${PLANNER_HEADING} | Plague Doctor`,
  description: PLANNER_INTRO,
};
export const SOCIAL_CARD: SocialCopy = {
  title: "Omen Card | Plague Doctor",
  description: `${SHARE_DATED_SNAPSHOT} ${caveatSentence()}`,
};
export const SOCIAL_METHODS: SocialCopy = {
  title: "Behind the mask — Plague Doctor",
  description: "Sources, definitions and limits of the PHAC wastewater data shown in Plague Doctor.",
};
/** City pages are described generically: metadata never fetches data or names a place. */
export const SOCIAL_CITY: SocialCopy = {
  title: "Wastewater observations by location | Plague Doctor",
  description:
    "Weekly PHAC wastewater observations for one monitoring location, with dates and sources. A community signal, not your personal chance of getting sick.",
};

// Download card as image (UI-19.31)
export const DOWNLOAD_CARD_IMAGE = "Download card as image";
export const DOWNLOAD_CARD_IMAGE_PREPARING = "Preparing card image";
export const DOWNLOAD_CARD_IMAGE_DONE = "Card image downloaded";
export const DOWNLOAD_CARD_IMAGE_FAILED =
  "The card image could not be created in this browser. Copy the share text instead.";
export const DOWNLOAD_CARD_IMAGE_NOTE = "The image is made on this device and has no attendee details.";

export const CARD_IMAGE_EVENT_DATE_LABEL = "Event date";
export const CARD_IMAGE_NO_ROWS = "No observations to show";

export function cardImageEventDate(s: { date: string }): string {
  return `${CARD_IMAGE_EVENT_DATE_LABEL}: ${formatDisplayDate(s.date)}`;
}

export function cardImageRow(s: { virus: string; level: string }): string {
  return `${s.virus}: ${s.level}`;
}
