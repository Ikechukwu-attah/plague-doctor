/**
 * Evidence engine types — EVD-1 through EVD-10.
 * All new types for card building, sharing, diffing, and freshness classification.
 * Imports base types from ./types; never redefines them.
 */
import type {
  Pathogen,
  Activity,
  Direction,
  UnknownReason,
  StatusObservation,
  CoverageStatus,
  LocationEntry,
  MeasuredWeek,
} from "./types";

// Re-export for convenience
export type { Pathogen, Activity, Direction, UnknownReason, CoverageStatus, LocationEntry, MeasuredWeek };

// EVD-1 output
export type FreshnessLabel =
  | "latest_available"
  | "delayed"
  | "outdated"
  | "no_data";

// EVD-3 output
export type TimingState = "too_early" | "near" | "past";

// EVD-2 output
export type CoverageResult =
  | { coverage: "city_site" | "site_only" | "national" }
  | {
      coverage: "no_city_site";
      regional?: StatusObservation;
      unknownReason?: UnknownReason;
    }
  | { coverage: "unknown" };

// Statement variant for timingState = "near"
export interface NearStatement {
  pathogen: Pathogen;
  activityIndex: Activity;
  signalLevel: Activity;
  trend: Direction;
  weekStart: string;
  freshnessLabel: FreshnessLabel;
  snapshotId: string;
  sourceUrl: string;
  ruleId: string;
  interpretationMethod: "publisher";
  unknownReason?: UnknownReason;
  /** true when this value is PHAC's provincial aggregate, NOT the requested city */
  regional?: true;
  /** Name of the region the values describe, e.g. "Ontario" (set iff regional) */
  regionLocationName?: string;
}

// Statement variant for timingState = "too_early" | "past"
export interface HistoricalContext {
  pathogen: Pathogen;
  epiWeek: number;
  histMin: number | null;
  histMax: number | null;
  wAvg?: number | null;
  weekStart?: string;
  label: "past observations, not a prediction";
  snapshotId: string;
  sourceUrl: string;
  ruleId: string;
}

// EVD-10
export interface PreventionChecklist {
  readonly items: readonly string[];
  readonly sourceUrl: string;
  readonly reviewedOn: string;
}

// EVD-4 output
export interface EventCard {
  locationId: string;
  locationName: string;
  eventDate: string;
  setting: string;
  timingState: TimingState;
  coverageType: CoverageStatus;
  freshnessLabel: FreshnessLabel;
  createdAt: string;
  statements: NearStatement[] | HistoricalContext[];
  regionalObservation?: StatusObservation;
  preventionChecklist: PreventionChecklist;
  /** Local rendering only — NEVER serialized for network/export/logs */
  attendeeCategories: string[];
  snapshotId: string;
  sourceUrl: string;
}

// EVD-6 output
export type DiffStatus = "unchanged" | "changed" | "revised" | "newly_missing";

export interface DiffEntry {
  pathogen: Pathogen;
  status: DiffStatus;
  baselineValue?: string;
  newValue?: string;
  baselineSnapshotId?: string;
  newSnapshotId?: string;
  baselineWeekStart?: string;
  newWeekStart?: string;
  /** e.g. "newer observation: Moderate → High" — NEVER contains "increasing" or "decreasing" */
  description?: string;
}

export interface DiffResult {
  locationId: string;
  eventDate: string;
  entries: DiffEntry[];
  baselineSnapshotId: string;
  currentSnapshotId: string;
}

// Card builder inputs (used by card.ts)
export interface CardBuilderInput {
  locationId: string;
  eventDate: string;
  setting: string;
  /** Local rendering only — never passed to any other function or network path */
  attendeeCategories: string[];
  createdAt: string;
  today: Date | string;
}

export interface CardBuilderData {
  observations: StatusObservation[];
  history: MeasuredWeek[];
  locationEntry: LocationEntry;
}
