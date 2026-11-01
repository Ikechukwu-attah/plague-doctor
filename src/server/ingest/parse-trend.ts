/**
 * ING-5: Trend CSV parser.
 * Maps PHAC source values to normalized types verbatim.
 * Handles NA1/NA2, NA1 + valid latestLevel coexistence, No Recent Data.
 *
 * Values are accessed by header name, never by index position.
 * Reordered columns are safe.
 */
import { parse as parseCsv } from "csv-parse/sync";
import type { StatusObservation, Activity, Direction, UnknownReason } from "@/evidence/types";
import { StatusObservationSchema } from "@/evidence/schemas";

// ---------------------------------------------------------------------------
// Value mapping tables (BUILD_PLAN §6, ING-5)
// ---------------------------------------------------------------------------

const ACTIVITY_MAP: Record<string, Activity> = {
  High: "high",
  Moderate: "moderate",
  Low: "low",
  "Non-detect": "not_detected",
  // NA1, NA2 handled separately to attach unknownReason
};

const DIRECTION_MAP: Record<string, Direction> = {
  Increasing: "increasing",
  "No Change": "stable",
  Decreasing: "decreasing",
  "No Recent Data": "unknown",
};

const PATHOGEN_MAP: Record<string, string> = {
  covN2: "covid19",
  fluA: "fluA",
  fluB: "fluB",
  rsv: "rsv",
};

const GROUPING_MAP: Record<string, string> = {
  Site: "site",
  City: "city",
  Province: "province",
  Canada: "national",
};

/**
 * Produce a deterministic, URL-safe locationId from PHAC's Location string.
 * Stable across schema changes; based on the raw location name.
 */
export function slugify(location: string): string {
  return location
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Map a Viral_Activity_Level or latestLevel string to Activity + optional UnknownReason.
 */
function mapActivity(raw: string | undefined): {
  activity: Activity;
  reason?: UnknownReason;
} {
  if (!raw || raw.trim() === "") {
    return { activity: "unknown", reason: "missing_row" };
  }
  const trimmed = raw.trim();
  if (trimmed === "NA1") {
    return { activity: "unknown", reason: "na1_new_site" };
  }
  if (trimmed === "NA2") {
    return { activity: "unknown", reason: "na2_not_sampling" };
  }
  const mapped = ACTIVITY_MAP[trimmed];
  if (mapped) return { activity: mapped };
  return { activity: "unknown", reason: "parse_error" };
}

/**
 * Map latestTrend to Direction.
 */
function mapDirection(raw: string | undefined): Direction {
  if (!raw || raw.trim() === "") return "unknown";
  return DIRECTION_MAP[raw.trim()] ?? "unknown";
}

export interface ParseTrendResult {
  observations: StatusObservation[];
  rejectedRows: number;
  schemaVersion: string;
  rowCount: number;
}

/**
 * Parse a trend CSV buffer into StatusObservation[].
 *
 * @param bytes     Raw CSV bytes from PHAC
 * @param schemaVersion  Schema version ID from the registry
 * @param snapshotId    sha256 of the raw file
 * @param sourceUrl     The original PHAC URL
 */
export function parseTrend(
  bytes: Buffer,
  schemaVersion: string,
  snapshotId: string,
  sourceUrl: string
): ParseTrendResult {
  const raw = parseCsv(bytes.toString("utf-8"), {
    columns: true, // first row is headers
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }) as Array<Record<string, string>>;

  const observations: StatusObservation[] = [];
  let rejectedRows = 0;

  for (const row of raw) {
    try {
      const locationName = row["Location"] ?? "";
      const measureid = row["measureid"] ?? "";
      const groupingRaw = row["grouping"] ?? "";
      const cityRaw = row["city"] ?? "";
      const provinceRaw = row["province"] ?? "";
      const weekStartRaw = row["weekStart"] ?? "";
      const pruid = row["pruid"] ?? "";

      const pathogen = PATHOGEN_MAP[measureid.trim()];
      const grouping = GROUPING_MAP[groupingRaw.trim()];

      if (!pathogen || !grouping) {
        rejectedRows++;
        continue;
      }

      const { activity: activityIndex, reason: unknownReason } = mapActivity(
        row["Viral_Activity_Level"]
      );

      // NA1 may coexist with a valid latestLevel (BUILD_PLAN §0 row 7)
      // Parse signalLevel independently regardless of activityIndex
      const { activity: signalLevel } = mapActivity(row["latestLevel"]);

      // Trend may independently be "No Recent Data" even when level is set
      const latestTrendRaw = row["latestTrend"] ?? "";
      const trend =
        latestTrendRaw.trim() === "No Recent Data"
          ? "unknown"
          : mapDirection(latestTrendRaw);

      // Normalize weekStart — PHAC uses YYYY-MM-DD (ISO)
      const weekStart = weekStartRaw.trim();

      const candidate: StatusObservation = {
        snapshotId,
        locationId: slugify(locationName),
        grouping: grouping as StatusObservation["grouping"],
        pathogen: pathogen as StatusObservation["pathogen"],
        weekStart,
        activityIndex,
        ...(unknownReason ? { unknownReason } : {}),
        signalLevel,
        trend,
        interpretationMethod: "publisher",
        sourceUrl,
        locationName,
        city: cityRaw,
        province: provinceRaw,
        pruid: (row["pruid"] ?? "").trim(),
        schemaVersion,
      };

      const parsed = StatusObservationSchema.safeParse(candidate);
      if (!parsed.success) {
        console.warn(
          `[parse-trend] Rejected row (${locationName} / ${measureid}):`,
          parsed.error.issues.map((i) => i.message).join("; ")
        );
        rejectedRows++;
        continue;
      }

      observations.push(parsed.data);
    } catch (err) {
      console.warn("[parse-trend] Unexpected error on row:", err);
      rejectedRows++;
    }
  }

  return {
    observations,
    rejectedRows,
    schemaVersion,
    rowCount: raw.length,
  };
}
