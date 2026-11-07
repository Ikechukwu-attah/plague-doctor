/**
 * Omen Card view model (UI-9). The too_early variant has no field that can carry
 * a level or an "as of" statement, mirroring the engine's two statement types.
 */
import type { EventCard, HistoricalContext, NearStatement } from "@/evidence/card-types";
import type { Pathogen, StatusObservation } from "@/evidence/types";
import { levelBadgeModel, type LevelBadgeModel } from "./level";
import { trendGlyphModel, type TrendGlyphModel } from "./trend";
import { lanternModel, type LanternModel } from "./freshness";
import { provenanceFor, type ProvenanceModel } from "./provenance";
import { COMMUNITY_CAVEAT, PAST_OBSERVATIONS_LABEL, NO_RECENT_DATA, cardTitle } from "@/ui-copy/card";
import { observedStrip, tooEarly, TOO_EARLY_SHORT } from "@/ui-copy/timing";
import { provincialAggregateNotice, noAggregate, regionalLabel } from "@/ui-copy/coverage";
import { unknownReason, UNKNOWN_NO_REASON } from "@/ui-copy/unknown-reasons";
import { KINDS, VENUES, settingLabel, type KindId, type VenueId } from "@/ui-copy/planner-options";

export interface CardHeader {
  title: string;
  place: string;
  eventDate: string;
  setting: string;
  createdAt: string;
  caveat: typeof COMMUNITY_CAVEAT;
  snapshotId: string;
  sourceUrl: string;
  /** On-screen only; never serialised anywhere. */
  attendeeChips: readonly string[];
}

export interface NearRowView {
  pathogen: Pathogen;
  badge: LevelBadgeModel;
  trend: TrendGlyphModel;
  lantern: LanternModel;
  weekStart?: string;
  regionLabel?: string;
  unknownText?: string;
  provenance: ProvenanceModel;
}

export interface HistoricalRowView {
  pathogen: Pathogen;
  label: typeof PAST_OBSERVATIONS_LABEL;
  weekStart?: string;
  wAvg?: number | null;
  histMin: number | null;
  histMax: number | null;
  gap: boolean;
}

export type CardView =
  | {
      timing: "near";
      header: CardHeader;
      observedStrip: string;
      rows: NearRowView[];
      regionalNotice?: string;
      missingDataNotice?: string;
    }
  | {
      timing: "too_early";
      header: CardHeader;
      headline: typeof TOO_EARLY_SHORT;
      sentence: string;
      rows: HistoricalRowView[];
    }
  | { timing: "past"; header: CardHeader; rows: HistoricalRowView[] };

function settingParts(setting: string): { title: string; label: string } {
  const [v, k] = setting.split(".");
  const venue = VENUES.find((x) => x.id === v);
  const kind = KINDS.find((x) => x.id === k);
  if (venue && kind) {
    return { title: kind.label, label: settingLabel(venue.id as VenueId, kind.id as KindId) };
  }
  return { title: setting, label: setting };
}

function headerOf(card: EventCard): CardHeader {
  const s = settingParts(card.setting);
  return {
    title: cardTitle({ kind: s.title, place: card.locationName }),
    place: card.locationName,
    eventDate: card.eventDate,
    setting: s.label,
    createdAt: card.createdAt,
    caveat: COMMUNITY_CAVEAT,
    snapshotId: card.snapshotId,
    sourceUrl: card.sourceUrl,
    attendeeChips: [...card.attendeeCategories],
  };
}

function groupingOf(card: EventCard): StatusObservation["grouping"] {
  switch (card.coverageType) {
    case "city_site":
      return "city";
    case "site_only":
      return "site";
    case "national":
      return "national";
    default:
      return "province";
  }
}

function nearRows(card: EventCard, stmts: NearStatement[]): NearRowView[] {
  return stmts.map((s) => {
    const regional = s.regional === true;
    const ctx = regional && card.regionalObservation
      ? {
          locationId: card.regionalObservation.locationId,
          grouping: "province" as const,
          locationName: s.regionLocationName ?? card.regionalObservation.locationName,
        }
      : { locationId: card.locationId, grouping: groupingOf(card), locationName: card.locationName };
    const row: NearRowView = {
      pathogen: s.pathogen,
      badge: levelBadgeModel(s.activityIndex, s.unknownReason),
      trend: trendGlyphModel(s.trend),
      lantern: lanternModel(s.freshnessLabel),
      provenance: provenanceFor(s, "Viral_Activity_Level", ctx),
    };
    if (s.weekStart) row.weekStart = s.weekStart;
    if (regional && s.regionLocationName) row.regionLabel = regionalLabel({ region: s.regionLocationName });
    if (s.activityIndex === "unknown") {
      row.unknownText = s.unknownReason ? unknownReason(s.unknownReason) : UNKNOWN_NO_REASON;
    }
    return row;
  });
}

function historicalRows(stmts: HistoricalContext[], past: boolean): HistoricalRowView[] {
  return stmts.map((s) => {
    const row: HistoricalRowView = {
      pathogen: s.pathogen,
      label: PAST_OBSERVATIONS_LABEL,
      histMin: s.histMin,
      histMax: s.histMax,
      gap: past ? s.wAvg == null || !s.weekStart : s.histMin == null || s.histMax == null,
    };
    if (past) {
      row.wAvg = s.wAvg ?? null;
      if (s.weekStart) row.weekStart = s.weekStart;
    }
    return row;
  });
}

export function buildCardView(card: EventCard, today: Date | string): CardView {
  void today; // timing was fixed by the engine when the card was built
  const header = headerOf(card);
  if (card.timingState === "near") {
    const stmts = card.statements as NearStatement[];
    const rows = nearRows(card, stmts);
    const weeks = stmts.map((s) => s.weekStart).filter((w) => w !== "");
    const latest = weeks.length > 0 ? weeks.reduce((a, b) => (b > a ? b : a)) : undefined;
    const view: Extract<CardView, { timing: "near" }> = {
      timing: "near",
      header,
      observedStrip: latest ? observedStrip({ week: latest }) : NO_RECENT_DATA,
      rows,
    };
    if (card.coverageType === "no_city_site") {
      view.regionalNotice = card.regionalObservation
        ? provincialAggregateNotice({ place: card.locationName, region: card.regionalObservation.locationName })
        : noAggregate({ place: card.locationName });
    }
    if (!latest) view.missingDataNotice = NO_RECENT_DATA;
    return view;
  }
  const hist = card.statements as HistoricalContext[];
  if (card.timingState === "too_early") {
    return {
      timing: "too_early",
      header,
      headline: TOO_EARLY_SHORT,
      sentence: tooEarly({ date: card.eventDate }),
      rows: historicalRows(hist, false),
    };
  }
  return { timing: "past", header, rows: historicalRows(hist, true) };
}
