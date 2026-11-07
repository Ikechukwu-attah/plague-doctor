/** Provenance view model (UI-7). Classifications are attributed to PHAC. */
import type { NearStatement } from "@/evidence/card-types";
import type { StatusObservation } from "@/evidence/types";
import { levelLabel, trendLabel, virusLabel } from "@/ui-copy/levels";
import { weekOf } from "@/ui-copy/timing";

export type ProvenanceField = "Viral_Activity_Level" | "latestLevel" | "latestTrend" | "weekStart";

export interface ProvenanceModel {
  statement: string;
  snapshotId: string;
  field: ProvenanceField;
  locationId: string;
  grouping: StatusObservation["grouping"];
  ruleId: string;
  interpretationMethod: "publisher";
  /** Rendered text for interpretationMethod. */
  interpretationText: "Published by PHAC";
  sourceUrl: string;
}

export function provenanceFor(
  stmt: NearStatement,
  which: ProvenanceField,
  ctx: { locationId: string; grouping: StatusObservation["grouping"]; locationName: string },
): ProvenanceModel {
  const head = `${virusLabel(stmt.pathogen)} in ${ctx.locationName}`;
  let statement: string;
  switch (which) {
    case "Viral_Activity_Level":
      statement = `${head}: ${levelLabel(stmt.activityIndex)}`;
      break;
    case "latestLevel":
      statement = `${head}, signal level: ${levelLabel(stmt.signalLevel)}`;
      break;
    case "latestTrend":
      statement = `${head}, trend: ${trendLabel(stmt.trend)}`;
      break;
    case "weekStart":
      statement = stmt.weekStart ? `${head}: ${weekOf(stmt.weekStart)}` : `${head}: no sample week`;
      break;
  }
  return {
    statement,
    snapshotId: stmt.snapshotId,
    field: which,
    locationId: ctx.locationId,
    grouping: ctx.grouping,
    ruleId: stmt.ruleId,
    interpretationMethod: stmt.interpretationMethod,
    interpretationText: "Published by PHAC",
    sourceUrl: stmt.sourceUrl,
  };
}
