/** Saved-event diff view model (UI-10.6–10.10). Revisions are never presented as measured change. */
import type { EventCard, DiffStatus, NearStatement, HistoricalContext } from "@/evidence/card-types";
import type { Activity, Pathogen } from "@/evidence/types";
import { diffCards } from "@/evidence/diff";
import { levelLabel } from "@/ui-copy/levels";
import { weekOf } from "@/ui-copy/timing";
import {
  DIFF_NEWLY_MISSING,
  DIFF_REVISED,
  DIFF_UNCHANGED,
  DIFF_UNCHANGED_ENTRY,
  NO_NEWER_SNAPSHOT,
  diffChanged,
} from "@/ui-copy/card";

export interface DiffLine {
  pathogen: Pathogen;
  status: DiffStatus;
  text: string;
  baselineWeek?: string;
  newWeek?: string;
  baselineSnapshotId?: string;
  newSnapshotId?: string;
}

export interface DiffView {
  state: "no_newer_snapshot" | "all_unchanged" | "has_changes";
  message?: string;
  lines: DiffLine[];
}

function stmtOf(card: EventCard, p: Pathogen): { weekStart?: string; snapshotId?: string } {
  const s = (card.statements as Array<NearStatement | HistoricalContext>).find((x) => x.pathogen === p);
  return { weekStart: s?.weekStart || undefined, snapshotId: s?.snapshotId || undefined };
}

export function buildDiffView(baseline: EventCard, current: EventCard): DiffView {
  const diff = diffCards(baseline, current);
  const lines: DiffLine[] = diff.entries.map((e) => {
    const b = stmtOf(baseline, e.pathogen);
    const c = stmtOf(current, e.pathogen);
    let text: string;
    switch (e.status) {
      case "changed":
        text = diffChanged({
          oldValue: levelLabel((e.baselineValue ?? "unknown") as Activity),
          newValue: levelLabel((e.newValue ?? "unknown") as Activity),
        });
        break;
      case "revised":
        text = e.newWeekStart ? `${DIFF_REVISED}: ${weekOf(e.newWeekStart)}` : DIFF_REVISED;
        break;
      case "newly_missing":
        text = DIFF_NEWLY_MISSING;
        break;
      default:
        text = DIFF_UNCHANGED_ENTRY;
    }
    const line: DiffLine = { pathogen: e.pathogen, status: e.status, text };
    if (e.status !== "unchanged") {
      const bw = e.baselineWeekStart ?? b.weekStart;
      const nw = e.newWeekStart ?? c.weekStart;
      const bs = e.baselineSnapshotId ?? b.snapshotId ?? baseline.snapshotId;
      const ns = e.newSnapshotId ?? c.snapshotId ?? current.snapshotId;
      if (bw) line.baselineWeek = bw;
      if (nw) line.newWeek = nw;
      if (bs) line.baselineSnapshotId = bs;
      if (ns) line.newSnapshotId = ns;
    }
    return line;
  });
  if (baseline.snapshotId === current.snapshotId) {
    return { state: "no_newer_snapshot", message: NO_NEWER_SNAPSHOT, lines };
  }
  if (lines.every((l) => l.status === "unchanged")) {
    return { state: "all_unchanged", message: DIFF_UNCHANGED, lines };
  }
  return { state: "has_changes", lines };
}
