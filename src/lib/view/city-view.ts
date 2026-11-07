/**
 * City view model (UI-5). Statements come from buildCard with eventDate = today
 * (K2), so classifications are PHAC's verbatim values. Only the requested
 * location's rows, or the PHAC provincial aggregate the API attached for a
 * no_city_site location, are ever passed in (UI-5.8).
 */
import type { CoverageStatus, LocationEntry, Pathogen, StatusObservation } from "@/evidence/types";
import type { NearStatement } from "@/evidence/card-types";
import { buildCard } from "@/evidence/card";
import { toTorontoDateString } from "@/evidence/date-utils";
import type { StatusResponse } from "@/lib/api/schemas";
import { levelBadgeModel, type LevelBadgeModel } from "./level";
import { trendGlyphModel, type TrendGlyphModel } from "./trend";
import { lanternModel, freshnessFor, type LanternModel } from "./freshness";
import { regionalLabel } from "@/ui-copy/coverage";
import { unknownReason, UNKNOWN_NO_REASON } from "@/ui-copy/unknown-reasons";

export interface CityVirusRow {
  pathogen: Pathogen;
  statement: NearStatement;
  /** Headline: PHAC Viral_Activity_Level. */
  headline: LevelBadgeModel;
  /** Secondary: PHAC latestLevel, rendered under its own label. */
  signal: LevelBadgeModel;
  trend: TrendGlyphModel;
  lantern: LanternModel;
  ageDays?: number;
  unknownText?: string;
  /** UI-5.12: history only, no current-activity wording. */
  outdated: boolean;
  /** UI-5.13: amber "Delayed" caution. */
  delayed: boolean;
}

export type CityCoverageNotice =
  | { kind: "none" }
  | {
      kind: "no_city_site";
      cityName: string;
      province: string;
      aggregate: "available" | "not_published";
      aggregateLabel?: string;
    };

export interface CityView {
  location: LocationEntry;
  coverage: CoverageStatus;
  /** Four rows in fixed order; empty when no value may be shown (offer only, or no aggregate). */
  rows: CityVirusRow[];
  notice: CityCoverageNotice;
  showingRegional: boolean;
  /** Name of the region the shown values describe; never the city name. */
  regionName?: string;
  sites: Array<{ locationId: string; locationName: string }>;
  snapshotId: string;
  sampleWeek: string;
  sourceUrl: string;
}

export function buildCityView(input: {
  status: StatusResponse;
  envelope: { snapshotId: string; sampleWeek: string; sourceUrl: string };
  showRegional: boolean;
  today: Date | string;
  /** Optional wider list used only to name this city's sites. */
  siteObservations?: StatusObservation[];
}): CityView {
  const { status, envelope, today } = input;
  const location = status.location as LocationEntry;
  const todayIso = toTorontoDateString(today);

  const own = status.observations.filter((o) => o.locationId === location.locationId);
  const agg = status.provinceAggregate;
  const aggObs = agg ? agg.observations.filter((o) => o.locationId === agg.location.locationId) : [];
  const isNoCitySite = location.coverage === "no_city_site" && own.length === 0;
  const aggregateAvailable = isNoCitySite && aggObs.length > 0;
  const showingRegional = aggregateAvailable && input.showRegional;

  const card = buildCard(
    {
      locationId: location.locationId,
      eventDate: todayIso,
      setting: "",
      attendeeCategories: [],
      createdAt: typeof today === "string" ? today : today.toISOString(),
      today,
    },
    {
      observations: showingRegional ? [...own, ...aggObs] : own,
      history: [],
      locationEntry: location,
    },
  );

  const regionName = showingRegional && agg ? agg.location.locationName : undefined;

  const valuesShown = !isNoCitySite || showingRegional;
  const rows: CityVirusRow[] = valuesShown
    ? (card.statements as NearStatement[]).map((s) => {
        const fresh = freshnessFor(s, today);
        const row: CityVirusRow = {
          pathogen: s.pathogen,
          statement: s,
          headline: levelBadgeModel(s.activityIndex, s.unknownReason),
          signal: levelBadgeModel(s.signalLevel),
          trend: trendGlyphModel(s.trend),
          lantern: lanternModel(s.freshnessLabel),
          outdated: s.freshnessLabel === "outdated",
          delayed: s.freshnessLabel === "delayed",
        };
        if (fresh.ageDays !== undefined) row.ageDays = fresh.ageDays;
        if (s.activityIndex === "unknown") {
          row.unknownText = s.unknownReason ? unknownReason(s.unknownReason) : UNKNOWN_NO_REASON;
        }
        return row;
      })
    : [];

  let notice: CityCoverageNotice = { kind: "none" };
  if (isNoCitySite) {
    notice = {
      kind: "no_city_site",
      cityName: location.city || location.locationName,
      province: location.province,
      aggregate: aggregateAvailable ? "available" : "not_published",
      ...(aggregateAvailable && agg ? { aggregateLabel: regionalLabel({ region: agg.location.locationName }) } : {}),
    };
  }

  const siteSrc = input.siteObservations ?? status.observations;
  const siteMap = new Map<string, string>();
  for (const o of siteSrc) {
    if (o.grouping === "site" && o.city === location.city && o.province === location.province) {
      siteMap.set(o.locationId, o.locationName);
    }
  }
  const sites = [...siteMap.entries()].map(([locationId, locationName]) => ({ locationId, locationName }));

  return {
    location,
    coverage: card.coverageType,
    rows,
    notice,
    showingRegional,
    ...(regionName ? { regionName } : {}),
    sites,
    snapshotId: envelope.snapshotId,
    sampleWeek: envelope.sampleWeek,
    sourceUrl: envelope.sourceUrl,
  };
}
