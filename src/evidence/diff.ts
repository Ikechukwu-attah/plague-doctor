/**
 * Saved-event diff — EVD-6.
 * Compares a baseline EventCard with a freshly built one, per pathogen.
 * Never describes missing/revised fields with increase/decrease language (P10).
 * Pure function.
 */
import type {
  EventCard,
  DiffEntry,
  DiffResult,
  NearStatement,
  HistoricalContext,
} from "./card-types";
import type { Pathogen, Activity } from "./types";

const PATHOGENS: readonly Pathogen[] = ["covid19", "fluA", "fluB", "rsv"];

interface StmtView {
  activityIndex?: Activity;
  weekStart?: string;
  snapshotId?: string;
}

/** Extract a comparable view from a statement of either variant. */
function viewOf(
  statements: NearStatement[] | HistoricalContext[],
  pathogen: Pathogen,
): StmtView | undefined {
  const s = (statements as Array<NearStatement | HistoricalContext>).find(
    (x) => x.pathogen === pathogen,
  );
  if (!s) return undefined;
  const near = s as NearStatement;
  return {
    activityIndex: typeof near.activityIndex === "string" ? near.activityIndex : undefined,
    weekStart: s.weekStart || undefined,
    snapshotId: s.snapshotId || undefined,
  };
}

/** True when the statement carries a usable (non-unknown) measured value. */
function hasValue(v: StmtView | undefined): boolean {
  return !!v && v.activityIndex !== undefined && v.activityIndex !== "unknown";
}

export function diffCards(baseline: EventCard, current: EventCard): DiffResult {
  const entries: DiffEntry[] = [];

  for (const pathogen of PATHOGENS) {
    const b = viewOf(baseline.statements, pathogen);
    const c = viewOf(current.statements, pathogen);

    const baseHas = hasValue(b);
    const curHas = hasValue(c);

    // newly_missing: baseline had a value, current does not.
    if (baseHas && !curHas) {
      entries.push({
        pathogen,
        status: "newly_missing",
        baselineValue: b!.activityIndex,
        baselineSnapshotId: b!.snapshotId,
        baselineWeekStart: b!.weekStart,
        description: `no current observation (was ${b!.activityIndex})`,
      });
      continue;
    }

    // If neither has a value, treat as unchanged (both unknown).
    if (!baseHas && !curHas) {
      entries.push({ pathogen, status: "unchanged" });
      continue;
    }

    // If baseline lacked a value but current has one, that's a change to a known value.
    if (!baseHas && curHas) {
      entries.push({
        pathogen,
        status: "changed",
        newValue: c!.activityIndex,
        newSnapshotId: c!.snapshotId,
        newWeekStart: c!.weekStart,
        description: `newer observation: (none) → ${c!.activityIndex}`,
      });
      continue;
    }

    // Both have values. Compare.
    const sameWeek = b!.weekStart === c!.weekStart;
    const sameSnapshot = b!.snapshotId === c!.snapshotId;
    const sameValue = b!.activityIndex === c!.activityIndex;

    // revised: same week, different snapshot (PHAC re-published that week).
    if (sameWeek && !sameSnapshot) {
      entries.push({
        pathogen,
        status: "revised",
        baselineValue: b!.activityIndex,
        newValue: c!.activityIndex,
        baselineSnapshotId: b!.snapshotId,
        newSnapshotId: c!.snapshotId,
        baselineWeekStart: b!.weekStart,
        newWeekStart: c!.weekStart,
        description: `PHAC revised the week of ${c!.weekStart}`,
      });
      continue;
    }

    // unchanged: same snapshot and same value.
    if (sameSnapshot && sameValue && sameWeek) {
      entries.push({ pathogen, status: "unchanged" });
      continue;
    }

    // changed: newer week or different value.
    entries.push({
      pathogen,
      status: "changed",
      baselineValue: b!.activityIndex,
      newValue: c!.activityIndex,
      baselineSnapshotId: b!.snapshotId,
      newSnapshotId: c!.snapshotId,
      baselineWeekStart: b!.weekStart,
      newWeekStart: c!.weekStart,
      description: `newer observation: ${b!.activityIndex} → ${c!.activityIndex}`,
    });
  }

  return {
    locationId: current.locationId,
    eventDate: current.eventDate,
    entries,
    baselineSnapshotId: baseline.snapshotId,
    currentSnapshotId: current.snapshotId,
  };
}
