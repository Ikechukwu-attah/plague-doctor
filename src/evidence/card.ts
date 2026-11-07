/**
 * Event card builder — EVD-3, EVD-4, EVD-10.
 *
 * Pure, deterministic. No I/O, no `new Date()`, no mutation of inputs.
 * `today` is always injected by the caller.
 *
 * Builds one statement per pathogen in a fixed order. The statement variant
 * depends on timingState:
 *   - "near"       → NearStatement (verbatim PHAC Viral_Activity_Level)
 *   - "too_early"  → HistoricalContext (historical min/max only, no w_avg)
 *   - "past"       → HistoricalContext (measured w_avg + historical min/max)
 *
 * attendeeCategories are copied onto the card struct for local rendering ONLY;
 * they are NEVER passed to any other function or network path.
 */
import type {
  Pathogen,
  StatusObservation,
  MeasuredWeek,
} from "./types";
import type {
  EventCard,
  CardBuilderInput,
  CardBuilderData,
  NearStatement,
  HistoricalContext,
  FreshnessLabel,
  CoverageStatus,
} from "./card-types";
import { classifyTiming } from "./timing";
import { resolveCoverage } from "./coverage";
import { classifyFreshness } from "./freshness";
import { dateToEpiWeek } from "./date-utils";
import { PREVENTION_CHECKLIST } from "./copy/checklist";
import { AGGREGATE_SOURCE_URL } from "./copy/sources";

/** Fixed pathogen order for statement construction. */
const PATHOGENS: readonly Pathogen[] = ["covid19", "fluA", "fluB", "rsv"];

/**
 * Derive a `latestTrend` string for classifyFreshness from a normalized
 * observation's trend. An "unknown" trend means PHAC reported no recent data.
 */
function latestTrendFor(obs: StatusObservation): string {
  return obs.trend === "unknown" ? "No Recent Data" : "No Change";
}

/**
 * Pick the most recent observation (max weekStart) from a set of rows.
 * Returns undefined for an empty set.
 */
function mostRecent(rows: StatusObservation[]): StatusObservation | undefined {
  let best: StatusObservation | undefined;
  for (const r of rows) {
    if (!best || r.weekStart > best.weekStart) best = r;
  }
  return best;
}

/**
 * Build a single NearStatement for a pathogen from the chosen location rows.
 */
function buildNearStatement(
  pathogen: Pathogen,
  rows: StatusObservation[],
  today: Date | string,
  regionName?: string,
): NearStatement {
  const obs = rows.find((o) => o.pathogen === pathogen);
  const regionalMark = regionName
    ? { regional: true as const, regionLocationName: regionName }
    : {};

  if (!obs) {
    // No row for this pathogen — explicit unknown (never low / not_detected).
    return {
      pathogen,
      activityIndex: "unknown",
      unknownReason: "missing_row",
      signalLevel: "unknown",
      trend: "unknown",
      weekStart: "",
      freshnessLabel: "no_data",
      snapshotId: "",
      sourceUrl: "",
      ruleId: "EVD-4.4",
      interpretationMethod: "publisher",
      ...regionalMark,
    };
  }

  const freshnessLabel = classifyFreshness(
    obs.weekStart,
    latestTrendFor(obs),
    obs.activityIndex,
    obs.unknownReason,
    today,
  );

  return {
    pathogen,
    activityIndex: obs.activityIndex, // verbatim Viral_Activity_Level
    signalLevel: obs.signalLevel,
    trend: obs.trend,
    weekStart: obs.weekStart,
    freshnessLabel,
    snapshotId: obs.snapshotId,
    sourceUrl: obs.sourceUrl,
    ruleId: "EVD-4.3",
    interpretationMethod: "publisher",
    ...(obs.unknownReason ? { unknownReason: obs.unknownReason } : {}),
    ...regionalMark,
  };
}

/**
 * Build a HistoricalContext for a pathogen keyed to the event's EpiWeek.
 *
 * @param includeMeasured  true for "past" (includes wAvg + weekStart),
 *                         false for "too_early" (historical band only).
 */
function buildHistoricalContext(
  pathogen: Pathogen,
  epiWeek: number,
  history: MeasuredWeek[],
  locationId: string,
  includeMeasured: boolean,
  fallbackSnapshotId: string,
  fallbackSourceUrl: string,
): HistoricalContext {
  const week = history.find(
    (w) =>
      w.locationId === locationId &&
      w.pathogen === pathogen &&
      w.epiWeek === epiWeek,
  );

  const ruleId = includeMeasured ? "EVD-3.7" : "EVD-3.5";

  if (!week) {
    // Gap — no measured week for this EpiWeek.
    const ctx: HistoricalContext = {
      pathogen,
      epiWeek,
      histMin: null,
      histMax: null,
      label: "past observations, not a prediction",
      snapshotId: fallbackSnapshotId,
      sourceUrl: fallbackSourceUrl,
      ruleId,
    };
    if (includeMeasured) {
      ctx.wAvg = null;
      ctx.weekStart = undefined;
    }
    return ctx;
  }

  const ctx: HistoricalContext = {
    pathogen,
    epiWeek,
    histMin: week.histMin,
    histMax: week.histMax,
    label: "past observations, not a prediction",
    snapshotId: week.snapshotId,
    sourceUrl: AGGREGATE_SOURCE_URL,
    ruleId,
  };

  if (includeMeasured) {
    ctx.wAvg = week.wAvg;
    ctx.weekStart = week.weekStart;
  }

  return ctx;
}

/**
 * Build an EventCard from injected inputs and data.
 *
 * Pure function. `attendeeCategories` are attached to the card struct only and
 * are never passed to any other function.
 */
export function buildCard(
  input: CardBuilderInput,
  data: CardBuilderData,
): EventCard {
  const { locationEntry } = data;

  // 1. Timing.
  const timingState = classifyTiming(input.eventDate, input.today);

  // 2 + 3. Coverage. The caller resolved the LocationEntry, so treat it as a
  // known Gazetteer city.
  const coverageResult = resolveCoverage(
    locationEntry.locationId,
    data.observations,
    true,
    locationEntry.pruid,
  );

  // 4. Map coverage to the EventCard CoverageStatus (which excludes "unknown").
  let coverageType: CoverageStatus;
  if (coverageResult.coverage === "unknown") {
    coverageType = "no_city_site"; // defensive fallback; should not occur here
  } else {
    coverageType = coverageResult.coverage;
  }

  // 5. Regional observation offered when no city/site row exists.
  let regionalObservation: StatusObservation | undefined;
  if (
    coverageResult.coverage === "no_city_site" &&
    coverageResult.regional
  ) {
    regionalObservation = coverageResult.regional;
  }

  // 6. Pick the rows to source NEAR statements from.
  //    Prefer the location's own rows; if none exist but a regional province
  //    observation is available, source from province-grouping rows for the
  //    location's pruid.
  const locObs = data.observations.filter(
    (o) => o.locationId === locationEntry.locationId,
  );
  let chosenRows: StatusObservation[];
  if (locObs.length > 0) {
    chosenRows = locObs;
  } else if (regionalObservation) {
    chosenRows = data.observations.filter(
      (o) => o.grouping === "province" && o.pruid === locationEntry.pruid,
    );
  } else {
    chosenRows = [];
  }

  // 7. Card-level freshness from the most recent chosen row.
  const freshestRow = mostRecent(chosenRows);
  const freshnessLabel: FreshnessLabel = freshestRow
    ? classifyFreshness(
        freshestRow.weekStart,
        latestTrendFor(freshestRow),
        freshestRow.activityIndex,
        freshestRow.unknownReason,
        input.today,
      )
    : "no_data";

  // Top-level snapshot / source — from the most recent chosen observation,
  // else the regional one, else empty.
  const topSnapshotId = freshestRow?.snapshotId ?? regionalObservation?.snapshotId ?? "";
  const topSourceUrl = freshestRow?.sourceUrl ?? regionalObservation?.sourceUrl ?? "";

  // 8. Build statements by timing.
  let statements: NearStatement[] | HistoricalContext[];
  if (timingState === "near") {
    const regionName =
      locObs.length === 0 && regionalObservation
        ? regionalObservation.locationName
        : undefined;
    statements = PATHOGENS.map((p) =>
      buildNearStatement(p, chosenRows, input.today, regionName),
    );
  } else {
    const { epiWeek } = dateToEpiWeek(input.eventDate);
    const includeMeasured = timingState === "past";
    statements = PATHOGENS.map((p) =>
      buildHistoricalContext(
        p,
        epiWeek,
        data.history,
        locationEntry.locationId,
        includeMeasured,
        "",
        AGGREGATE_SOURCE_URL,
      ),
    );
  }

  // 9 – 12. Assemble the card.
  const card: EventCard = {
    locationId: input.locationId,
    locationName: locationEntry.locationName,
    eventDate: input.eventDate,
    setting: input.setting,
    timingState,
    coverageType,
    freshnessLabel,
    createdAt: input.createdAt,
    statements,
    preventionChecklist: PREVENTION_CHECKLIST,
    attendeeCategories: input.attendeeCategories,
    snapshotId:
      timingState === "near"
        ? topSnapshotId
        : (data.history.find((w) => w.locationId === locationEntry.locationId)
            ?.snapshotId ?? ""),
    sourceUrl: timingState === "near" ? topSourceUrl : AGGREGATE_SOURCE_URL,
    ...(regionalObservation ? { regionalObservation } : {}),
  };

  return card;
}
