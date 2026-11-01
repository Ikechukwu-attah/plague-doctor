/**
 * Zod schemas derived from the normalized types.
 * These are the validation layer — they mirror types.ts exactly.
 */
import { z } from "zod";

export const PathogenSchema = z.enum(["covid19", "fluA", "fluB", "rsv"]);

export const ActivitySchema = z.enum([
  "high",
  "moderate",
  "low",
  "not_detected",
  "unknown",
]);

export const UnknownReasonSchema = z.enum([
  "na1_new_site",
  "na2_not_sampling",
  "no_recent_data",
  "aggregate_below_coverage",
  "missing_row",
  "parse_error",
]);

export const DirectionSchema = z.enum([
  "increasing",
  "stable",
  "decreasing",
  "unknown",
]);

export const GroupingSchema = z.enum(["site", "city", "province", "national"]);

export const StatusObservationSchema = z.object({
  snapshotId: z.string().min(64).max(64), // sha256 hex
  locationId: z.string().min(1),
  grouping: GroupingSchema,
  pathogen: PathogenSchema,
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activityIndex: ActivitySchema,
  unknownReason: UnknownReasonSchema.optional(),
  signalLevel: ActivitySchema,
  trend: DirectionSchema,
  interpretationMethod: z.literal("publisher"),
  sourceUrl: z.string().url(),
  locationName: z.string().min(1),
  city: z.string(),
  province: z.string(),
  pruid: z.string(),
  schemaVersion: z.string().min(1),
});

export const MeasuredWeekSchema = z.object({
  snapshotId: z.string().min(64).max(64),
  locationId: z.string().min(1),
  locationName: z.string().min(1),
  pathogen: PathogenSchema,
  epiYear: z.number().int().min(2020),
  epiWeek: z.number().int().min(1).max(53),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wAvg: z.number().nullable(),
  histMin: z.number().nullable(),
  histMax: z.number().nullable(),
  populationCoverage: z.number().nullable(),
});

export const SourceSnapshotSchema = z.object({
  snapshotId: z.string().min(64).max(64),
  sourceUrl: z.string().url(),
  fetchedAt: z.string().datetime(),
  lastModified: z.string().optional(),
  etag: z.string().optional(),
  origin: z.enum(["live", "wayback"]),
  archivedAt: z.string().optional(),
  schemaVersion: z.string().min(1),
  rowCount: z.number().int().min(0),
  rejectedRows: z.number().int().min(0),
  status: z.enum(["valid", "rejected"]),
});

export type StatusObservationInput = z.input<typeof StatusObservationSchema>;
export type MeasuredWeekInput = z.input<typeof MeasuredWeekSchema>;
