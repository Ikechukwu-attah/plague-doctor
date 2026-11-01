/**
 * ING-5 / ING-6: Aggregate CSV parser.
 * Maps PHAC aggregate file to MeasuredWeek[].
 * No level or trend columns exist in this file — only w_avg + historical min/max.
 *
 * histMin/histMax are extremes across all recorded observations for that EpiWeek,
 * NOT confidence intervals or forecasts (BUILD_PLAN review amendment).
 */
import { parse as parseCsv } from "csv-parse/sync";
import type { MeasuredWeek } from "@/evidence/types";
import { MeasuredWeekSchema } from "@/evidence/schemas";
import { slugify } from "./parse-trend";

const PATHOGEN_MAP: Record<string, string> = {
  covN2: "covid19",
  fluA: "fluA",
  fluB: "fluB",
  rsv: "rsv",
};

/**
 * Parse a nullable numeric field from a CSV cell.
 * Empty string, "NA", or any non-numeric value → null.
 */
function parseNullableFloat(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "" || raw.trim().toUpperCase() === "NA") {
    return null;
  }
  const n = parseFloat(raw.trim());
  return isFinite(n) ? n : null;
}

function parseNullableInt(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "" || raw.trim().toUpperCase() === "NA") {
    return null;
  }
  const n = parseInt(raw.trim(), 10);
  return isFinite(n) ? n : null;
}

export interface ParseAggregateResult {
  weeks: MeasuredWeek[];
  rejectedRows: number;
  rowCount: number;
}

/**
 * Parse an aggregate CSV buffer into MeasuredWeek[].
 *
 * @param bytes       Raw CSV bytes from PHAC
 * @param snapshotId  sha256 of the raw file
 * @param sourceUrl   The original PHAC URL
 */
export function parseAggregate(
  bytes: Buffer,
  snapshotId: string,
  sourceUrl: string
): ParseAggregateResult {
  const raw = parseCsv(bytes.toString("utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }) as Array<Record<string, string>>;

  const weeks: MeasuredWeek[] = [];
  let rejectedRows = 0;

  for (const row of raw) {
    try {
      const locationName = row["Location"] ?? "";
      const measureid = row["measureid"] ?? "";
      const weekstartRaw = row["weekstart"] ?? ""; // lowercase in aggregate file

      const pathogen = PATHOGEN_MAP[measureid.trim()];
      if (!pathogen) {
        rejectedRows++;
        continue;
      }

      const epiYear = parseNullableInt(row["EpiYear"]);
      const epiWeek = parseNullableInt(row["EpiWeek"]);

      if (epiYear === null || epiWeek === null) {
        rejectedRows++;
        continue;
      }

      const candidate: MeasuredWeek = {
        snapshotId,
        locationId: slugify(locationName),
        locationName,
        pathogen: pathogen as MeasuredWeek["pathogen"],
        epiYear,
        epiWeek,
        weekStart: weekstartRaw.trim(),
        wAvg: parseNullableFloat(row["w_avg"]),
        histMin: parseNullableFloat(row["min"]),
        histMax: parseNullableFloat(row["max"]),
        populationCoverage: parseNullableFloat(row["populationcoverage"]),
      };

      const parsed = MeasuredWeekSchema.safeParse(candidate);
      if (!parsed.success) {
        console.warn(
          `[parse-aggregate] Rejected row (${locationName} / ${measureid}):`,
          parsed.error.issues.map((i) => i.message).join("; ")
        );
        rejectedRows++;
        continue;
      }

      weeks.push(parsed.data);
    } catch (err) {
      console.warn("[parse-aggregate] Unexpected error on row:", err);
      rejectedRows++;
    }
  }

  return { weeks, rejectedRows, rowCount: raw.length };
}
