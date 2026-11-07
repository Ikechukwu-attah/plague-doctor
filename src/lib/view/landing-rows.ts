/** Landing row view models (UI-3.3, UI-3.6, UI-3.8, UI-3.9, UI-4.1, UI-4.4, C19, C23). */
import type {
  Direction,
  LocationEntry,
  Pathogen,
  StatusObservation,
  UnknownReason,
} from "@/evidence/types";
import type { FreshnessLabel } from "@/evidence/card-types";
import cityPoints from "@/data/geo/city-points.json";
import { levelBadgeModel, type LevelBadgeModel } from "./level";
import { freshnessFor } from "./freshness";
import { levelLabel, trendLabel, virusLabel } from "@/ui-copy/levels";
import { weekOf } from "@/ui-copy/timing";

export interface LandingRow {
  location: LocationEntry;
  observation?: StatusObservation;
  badge: LevelBadgeModel;
  trend: Direction;
  weekStart?: string;
  freshness: FreshnessLabel;
  ageDays?: number;
  noSite: boolean;
  stopped: boolean;
  stoppedReason?: UnknownReason;
  /** Words for a stopped row (C23). Never says PHAC discontinued anything. */
  stoppedText?: string;
  point?: { x: number; y: number };
  /** Accessible name for the map marker / list row (UI-3.6). */
  markerLabel: string;
}

export type PointTable = Readonly<Record<string, { x: number; y: number }>>;

const POINTS: PointTable = (cityPoints as { entries: PointTable }).entries;

export function buildLandingRows(input: {
  locations: LocationEntry[];
  observations: StatusObservation[];
  virus: Pathogen;
  today: Date | string;
  showDiscontinued: boolean;
  /** Defaults to src/data/geo/city-points.json (keyed by locationId). */
  points?: PointTable;
}): LandingRow[] {
  const points = input.points ?? POINTS;
  const cand = input.locations.filter(
    (l) => l.grouping === "city" || l.grouping === "site",
  );
  const cityKeys = new Set(
    cand.filter((l) => l.grouping === "city").map((l) => `${l.city}\u0000${l.province}`),
  );
  // Site rows fold under their city row (drill-down) when one exists.
  const listed = cand.filter(
    (l) => l.grouping === "city" || !cityKeys.has(`${l.city}\u0000${l.province}`),
  );

  const obsById = new Map<string, StatusObservation>();
  for (const o of input.observations) {
    if (o.pathogen !== input.virus) continue;
    if (!obsById.has(o.locationId)) obsById.set(o.locationId, o);
  }

  const rows = listed.map((location): LandingRow => {
    const obs = obsById.get(location.locationId);
    const noSite = location.coverage === "no_city_site";
    const pt = Object.prototype.hasOwnProperty.call(points, location.locationId)
      ? points[location.locationId]
      : undefined;
    const virus = virusLabel(input.virus);

    if (!obs) {
      const reason: UnknownReason = "missing_row";
      return {
        location,
        badge: levelBadgeModel("unknown", reason),
        trend: "unknown",
        freshness: "no_data",
        noSite,
        stopped: false,
        ...(pt ? { point: { x: pt.x, y: pt.y } } : {}),
        markerLabel: noSite
          ? `${location.locationName}, no monitoring site`
          : `${location.locationName}, ${virus}: no data`,
      };
    }

    const f = freshnessFor(obs, input.today);
    const stopped = obs.unknownReason === "na2_not_sampling" || obs.trend === "unknown";
    const stoppedText = !stopped
      ? undefined
      : obs.unknownReason === "na2_not_sampling"
        ? "Stopped sampling or no recent data (NA2)"
        : "No recent data";
    const level = levelLabel(obs.activityIndex);
    const label =
      obs.activityIndex === "unknown"
        ? `${location.locationName}, ${virus}: no data, ${weekOf(obs.weekStart)}`
        : `${location.locationName}, ${virus}: ${level}, ${trendLabel(obs.trend)}, ${weekOf(obs.weekStart)}`;
    return {
      location,
      observation: obs,
      badge: levelBadgeModel(obs.activityIndex, obs.unknownReason),
      trend: obs.trend,
      weekStart: obs.weekStart,
      freshness: f.label,
      ...(f.ageDays !== undefined ? { ageDays: f.ageDays } : {}),
      noSite,
      stopped,
      ...(stopped && obs.unknownReason ? { stoppedReason: obs.unknownReason } : {}),
      ...(stoppedText ? { stoppedText } : {}),
      ...(pt ? { point: { x: pt.x, y: pt.y } } : {}),
      markerLabel: label,
    };
  });

  return rows
    .filter((r) => input.showDiscontinued || !r.stopped)
    .sort(
      (a, b) =>
        a.location.locationName.localeCompare(b.location.locationName) ||
        a.location.locationId.localeCompare(b.location.locationId),
    );
}
