/** The three clocks (UI-1.9, UI-14.7): sample week, PHAC file updated, our last ingest. */
import type { SourceSnapshot } from "@/evidence/types";
import { TREND_SOURCE_URL } from "@/evidence/copy/sources";
import { toTorontoDateString } from "@/evidence/date-utils";
import type { DataStatusResponse } from "@/lib/api/schemas";

export interface ThreeClocksModel {
  /** weekStart of the latest trend rows; render with weekOf(). */
  sampleWeek?: string;
  /** Matched snapshot lastModified (HTTP-date) as a Toronto calendar date. */
  phacFileUpdated?: string;
  /** Matched snapshot fetchedAt. */
  ourLastIngest?: string;
  snapshotId?: string;
  schemaVersion?: string;
}

type DataStatusInput = Pick<DataStatusResponse, "latestSampleWeekByPathogen" | "trendSnapshotId"> &
  Partial<Pick<DataStatusResponse, "schemaVersion">>;

function httpDateToIso(value: string | undefined): string | undefined {
  if (!value || Number.isNaN(Date.parse(value))) return undefined;
  return toTorontoDateString(value);
}

export function buildThreeClocks(args: {
  dataStatus: DataStatusInput;
  snapshots: SourceSnapshot[];
}): ThreeClocksModel {
  const { dataStatus, snapshots } = args;
  const weeks = Object.values(dataStatus.latestSampleWeekByPathogen).sort();
  const model: ThreeClocksModel = {};
  const sampleWeek = weeks[weeks.length - 1];
  if (sampleWeek) model.sampleWeek = sampleWeek;

  const id = dataStatus.trendSnapshotId;
  if (!id) return model;
  const match = snapshots.find(
    (s) => s.snapshotId === id && s.sourceUrl === TREND_SOURCE_URL && s.status === "valid",
  );
  if (!match) return model;

  model.snapshotId = match.snapshotId;
  model.schemaVersion = match.schemaVersion;
  model.ourLastIngest = match.fetchedAt;
  const updated = httpDateToIso(match.lastModified);
  if (updated) model.phacFileUpdated = updated;
  return model;
}
