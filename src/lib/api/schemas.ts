/**
 * Response validation for the read API (UI-2.5, UI-12.2).
 * Reuses the evidence-engine schemas; snapshot lists are parsed leniently
 * because index.json is shared state.
 */
import { z } from "zod";
import {
  StatusObservationSchema,
  MeasuredWeekSchema,
  SourceSnapshotSchema,
} from "@/evidence/schemas";
import type { LocationEntry, SourceSnapshot } from "@/evidence/types";
import type { ApiLocationEntry } from "./location-types";
export type { ApiCoverage, ApiLocationEntry, RegionalSiteInfo } from "./location-types";

export { StatusObservationSchema, MeasuredWeekSchema, SourceSnapshotSchema };

export const CoverageStatusSchema = z.enum([
  "city_site",
  "site_only",
  "no_city_site",
  "province_aggregate",
  "national",
]);

const ApiCoverageSchema = z.enum([
  "city_site",
  "site_only",
  "no_city_site",
  "province_aggregate",
  "national",
  "regional_site",
]);
const RegionalSiteInfoSchema = z.object({
  targetLocationId: z.string().min(1),
  targetName: z.string(),
  citation: z.string().min(1),
  siteNames: z.array(z.string()),
});
/** Evidence-shaped entry (used for provincial aggregates). */
const BaseLocationEntrySchema: z.ZodType<LocationEntry> = z.lazy(() =>
  z.object({
    locationId: z.string().min(1),
    locationName: z.string(),
    city: z.string(),
    province: z.string(),
    pruid: z.string(),
    grouping: z.enum(["site", "city", "province", "national"]),
    coverage: CoverageStatusSchema,
    provinceAggregate: BaseLocationEntrySchema.optional(),
  }),
);
export const LocationEntrySchema: z.ZodType<ApiLocationEntry> = z.object({
  locationId: z.string().min(1),
  locationName: z.string(),
  city: z.string(),
  province: z.string(),
  pruid: z.string(),
  grouping: z.enum(["site", "city", "province", "national"]),
  coverage: ApiCoverageSchema,
  provinceAggregate: BaseLocationEntrySchema.optional(),
  regional: RegionalSiteInfoSchema.optional(),
});

/** Envelope fields (snapshotId may be "" when no data exists). */
export const EnvelopeMetaSchema = z.object({
  snapshotId: z.string(),
  sampleWeek: z.string(),
  sourceUrl: z.string(),
});
export type EnvelopeMeta = z.infer<typeof EnvelopeMetaSchema>;

export function ApiEnvelopeSchema<T extends z.ZodTypeAny>(data: T) {
  return EnvelopeMetaSchema.extend({ data });
}

export const DataStatusSchema = z.object({
  snapshotCount: z.number().int().min(0),
  lastSuccessfulFetch: z.string().nullable(),
  latestSampleWeekByPathogen: z.record(z.string()),
  schemaVersion: z.string().nullable(),
  trendSnapshotId: z.string().nullable(),
});
export type DataStatusResponse = z.infer<typeof DataStatusSchema>;

export const StatusResponseSchema = z.object({
  location: LocationEntrySchema,
  coverage: z.string(),
  observations: z.array(StatusObservationSchema),
  provinceAggregate: z
    .object({
      location: LocationEntrySchema,
      observations: z.array(StatusObservationSchema),
    })
    .optional(),
});
export type StatusResponse = z.infer<typeof StatusResponseSchema>;

/** Drop invalid snapshot entries and count them. */
export function parseSnapshotsLenient(raw: unknown): {
  snapshots: SourceSnapshot[];
  dropped: number;
} | null {
  if (!Array.isArray(raw)) return null;
  const snapshots: SourceSnapshot[] = [];
  let dropped = 0;
  for (const item of raw as unknown[]) {
    const r = SourceSnapshotSchema.safeParse(item);
    if (r.success) snapshots.push(r.data as SourceSnapshot);
    else dropped += 1;
  }
  return { snapshots, dropped };
}
