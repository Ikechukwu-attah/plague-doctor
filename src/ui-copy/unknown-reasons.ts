/**
 * Unknown reasons — PHAC definitions (scientific-integrity rule).
 * Unknown is never rendered as low, not detected, or "none".
 */
import type { UnknownReason } from "../evidence/types";

const TEXT: Record<UnknownReason, string> = {
  na1_new_site: "Newly onboarded site, under 12 months of data, awaiting baseline.",
  na2_not_sampling: "Site stopped sampling, has no recent data, or is not being sampled.",
  no_recent_data: "PHAC reports no recent data for this site.",
  aggregate_below_coverage: "Aggregate not published (coverage below PHAC threshold).",
  missing_row: "No row for this location and virus in the current snapshot.",
  parse_error: "This row could not be read from the source file.",
};

export function unknownReason(r: UnknownReason): string {
  return TEXT[r];
}

export const UNKNOWN_REASONS: readonly UnknownReason[] = Object.keys(TEXT) as UnknownReason[];

/** Used when an unknown has no recorded reason. */
export const UNKNOWN_NO_REASON = "No data for this location and virus.";
