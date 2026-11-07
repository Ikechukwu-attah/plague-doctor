/**
 * Share text generator — EVD-5.
 * Produces deterministic, PII-free share text from an EventCard.
 * NEVER includes attendeeCategories (P8). Does NOT call the wording guard
 * internally (EVD-5.7). Human-readable dates (design §11).
 */
import type { EventCard, NearStatement, HistoricalContext } from "./card-types";
import type { Pathogen, Activity } from "./types";
import { formatDisplayDate } from "./date-utils";
import { AGGREGATE_SOURCE_URL, TREND_SOURCE_URL } from "./copy/sources";

const PATHOGEN_LABEL: Record<Pathogen, string> = {
  covid19: "COVID-19",
  fluA: "Flu A",
  fluB: "Flu B",
  rsv: "RSV",
};

const ACTIVITY_LABEL: Record<Activity, string> = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
  not_detected: "Not detected",
  unknown: "No data",
};

const NO_FORECAST_CAVEAT =
  "This is community wastewater, not your chance of getting sick. It is not a forecast.";

export function generateShareText(card: EventCard): string {
  const lines: string[] = [];
  lines.push(`Plague Doctor — ${card.locationName}`);
  lines.push(`Event date: ${formatDisplayDate(card.eventDate)}`);
  lines.push("");

  const noSite = card.coverageType === "no_city_site";

  if (card.timingState === "near") {
    const stmts = card.statements as NearStatement[];
    let regionSuffix = "";
    if (noSite) {
      if (card.regionalObservation) {
        const region = card.regionalObservation.locationName;
        regionSuffix = ` (${region} provincial aggregate)`;
        lines.push(
          `No ${card.locationName} monitoring site — showing ${region} provincial aggregate (PHAC), not ${card.locationName}`,
        );
      } else {
        lines.push(
          `No ${card.locationName} monitoring site and no PHAC provincial aggregate available.`,
        );
      }
    }
    const hasRegion = noSite && !!card.regionalObservation;
    for (const s of stmts) {
      const virus = PATHOGEN_LABEL[s.pathogen];
      const level = ACTIVITY_LABEL[s.activityIndex];
      const label = hasRegion ? `${virus}${regionSuffix}` : virus;
      if (s.weekStart) {
        lines.push(
          `${label}: ${level} — as of week of ${formatDisplayDate(s.weekStart)}, not on your event date`,
        );
      } else {
        lines.push(`${label}: ${level}`);
      }
    }
  } else if (card.timingState === "past") {
    const stmts = card.statements as HistoricalContext[];
    if (noSite) lines.push(`No ${card.locationName} monitoring site.`);
    for (const s of stmts) {
      const virus = PATHOGEN_LABEL[s.pathogen];
      if (s.weekStart) {
        let line = `${virus}: observed week of ${formatDisplayDate(s.weekStart)}`;
        if (s.wAvg != null) {
          line += ` — measured weekly average ${s.wAvg.toFixed(2)} (PHAC units)`;
        }
        if (s.histMin != null && s.histMax != null) {
          line += `; historical min–max ${s.histMin.toFixed(2)}–${s.histMax.toFixed(2)} (PHAC units)`;
        }
        lines.push(line);
      } else {
        lines.push(`${virus}: no observation for that week`);
      }
    }
  } else {
    // too_early
    const stmts = card.statements as HistoricalContext[];
    lines.push("Too early to know — not conditions on your date.");
    if (noSite) lines.push(`No ${card.locationName} monitoring site.`);
    for (const s of stmts) {
      const virus = PATHOGEN_LABEL[s.pathogen];
      if (s.histMin != null && s.histMax != null) {
        lines.push(
          `${virus}: historical min–max of measured weekly average for that week (PHAC units) ${s.histMin.toFixed(2)}–${s.histMax.toFixed(2)} — past observations, not a prediction`,
        );
      } else {
        lines.push(`${virus}: no past observations for that week`);
      }
    }
  }

  lines.push("");
  lines.push(NO_FORECAST_CAVEAT);
  const source =
    card.timingState === "near"
      ? card.sourceUrl || TREND_SOURCE_URL
      : AGGREGATE_SOURCE_URL;
  lines.push(`Source: ${source}`);

  return lines.join("\n");
}
