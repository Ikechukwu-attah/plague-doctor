/**
 * ING-3: Header-fingerprint schema registry.
 *
 * A fingerprint is the SHA-256 of sorted, lowercased, pipe-joined required
 * column names. This makes it order-independent — reordered known columns
 * hash to the same fingerprint and are accepted.
 *
 * Adding a new schema version does NOT require changing parser logic.
 */
import { createHash } from "crypto";

export type FileType = "trend" | "aggregate";

export interface SchemaDefinition {
  /** Human-readable version ID — referenced in SourceSnapshot.schemaVersion */
  versionId: string;
  fileType: FileType;
  /** The exact set of required column names (case-sensitive, as in the CSV). */
  requiredColumns: ReadonlyArray<string>;
  /**
   * Pre-computed fingerprint.
   * Generated at module init via fingerprintColumns(requiredColumns).
   */
  fingerprint: string;
}

/**
 * Compute the order-independent fingerprint for a set of column names.
 * Algorithm: SHA-256( sorted(cols.map(c => c.toLowerCase())).join("|") )
 */
export function fingerprintColumns(columns: ReadonlyArray<string>): string {
  const sorted = [...columns].map((c) => c.toLowerCase()).sort();
  return createHash("sha256").update(sorted.join("|")).digest("hex");
}

// ---------------------------------------------------------------------------
// Registered schemas
// ---------------------------------------------------------------------------

const SCHEMA_DEFINITIONS_RAW: Array<Omit<SchemaDefinition, "fingerprint">> = [
  {
    versionId: "trend-oct-2026",
    fileType: "trend",
    // Verified columns from BUILD_PLAN §6, audit trail 2026-10-31
    requiredColumns: [
      "Location",
      "measureid",
      "latestTrend",
      "pruid",
      "min",
      "max",
      "latestLevel",
      "grouping",
      "city",
      "province",
      "country",
      "Viral_Activity_Level",
      "weekStart",
    ],
  },
  {
    versionId: "trend-dec-2025",
    fileType: "trend",
    // Dec 2025 variant: t_low/t_high instead of min/max (BUILD_PLAN §0 row 3)
    requiredColumns: [
      "Location",
      "measureid",
      "latestTrend",
      "pruid",
      "t_low",
      "t_high",
      "latestLevel",
      "grouping",
      "city",
      "province",
      "country",
      "Viral_Activity_Level",
      "weekStart",
    ],
  },
  {
    versionId: "aggregate-v1",
    fileType: "aggregate",
    // Verified columns from BUILD_PLAN §6
    requiredColumns: [
      "Location",
      "site",
      "city",
      "province",
      "country",
      "EpiYear",
      "EpiWeek",
      "weekstart",
      "measureid",
      "w_avg",
      "min",
      "max",
      "populationcoverage",
      "pruid",
    ],
  },
];

/** Registry: map from fingerprint → SchemaDefinition */
const REGISTRY = new Map<string, SchemaDefinition>();

for (const raw of SCHEMA_DEFINITIONS_RAW) {
  const fingerprint = fingerprintColumns(raw.requiredColumns);
  REGISTRY.set(fingerprint, { ...raw, fingerprint });
}

/**
 * Detect the schema version for a set of actual CSV headers.
 *
 * Returns the SchemaDefinition if the headers match a registered schema
 * (order-independent), or null if no match is found (fail closed).
 *
 * Extra unexpected columns → no match (explicit compatibility review required).
 * Missing required columns → no match.
 */
export function detectSchema(
  fileType: FileType,
  actualHeaders: ReadonlyArray<string>
): SchemaDefinition | null {
  const fingerprint = fingerprintColumns(actualHeaders);
  const schema = REGISTRY.get(fingerprint);
  if (!schema) return null;
  if (schema.fileType !== fileType) return null;
  return schema;
}

/**
 * List all registered schemas for a given file type.
 * Used for diagnostics and testing.
 */
export function listSchemas(fileType: FileType): SchemaDefinition[] {
  return [...REGISTRY.values()].filter((s) => s.fileType === fileType);
}

/**
 * Get a specific schema by versionId.
 */
export function getSchemaByVersion(
  versionId: string
): SchemaDefinition | undefined {
  return [...REGISTRY.values()].find((s) => s.versionId === versionId);
}
