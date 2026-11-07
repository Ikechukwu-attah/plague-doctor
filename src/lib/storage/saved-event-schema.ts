/**
 * Saved-event schema (UI-10.2, UI-10.3). The stored card is strict and has NO
 * attendee key, so the attendee list cannot be persisted through the card.
 */
import { z } from "zod";
import { ActivitySchema, DirectionSchema, PathogenSchema, StatusObservationSchema, UnknownReasonSchema } from "@/evidence/schemas";
import { ATTENDEE_CATEGORIES } from "@/ui-copy/planner-options";

export const STORAGE_KEY = "pd.savedEvents.v1";

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const FreshnessSchema = z.enum(["latest_available", "delayed", "outdated", "no_data"]);

export const NearStatementSchema = z
  .object({
    pathogen: PathogenSchema,
    activityIndex: ActivitySchema,
    signalLevel: ActivitySchema,
    trend: DirectionSchema,
    weekStart: z.string(),
    freshnessLabel: FreshnessSchema,
    snapshotId: z.string(),
    sourceUrl: z.string(),
    ruleId: z.string(),
    interpretationMethod: z.literal("publisher"),
    unknownReason: UnknownReasonSchema.optional(),
    regional: z.literal(true).optional(),
    regionLocationName: z.string().optional(),
  })
  .strict();

export const HistoricalContextSchema = z
  .object({
    pathogen: PathogenSchema,
    epiWeek: z.number().int(),
    histMin: z.number().nullable(),
    histMax: z.number().nullable(),
    wAvg: z.number().nullable().optional(),
    weekStart: z.string().optional(),
    label: z.literal("past observations, not a prediction"),
    snapshotId: z.string(),
    sourceUrl: z.string(),
    ruleId: z.string(),
  })
  .strict();

export const StoredCardSchema = z
  .object({
    locationId: z.string().min(1),
    locationName: z.string().min(1),
    eventDate: IsoDate,
    setting: z.string(),
    timingState: z.enum(["too_early", "near", "past"]),
    coverageType: z.enum(["city_site", "site_only", "no_city_site", "province_aggregate", "national"]),
    freshnessLabel: FreshnessSchema,
    createdAt: z.string().datetime({ offset: true }),
    statements: z.union([z.array(NearStatementSchema), z.array(HistoricalContextSchema)]),
    regionalObservation: StatusObservationSchema.optional(),
    preventionChecklist: z.object({
      items: z.array(z.string()),
      sourceUrl: z.string().url(),
      reviewedOn: IsoDate,
    }),
    snapshotId: z.string(),
    sourceUrl: z.string(),
  })
  .strict();

export const SavedEventRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    savedAt: z.string().datetime({ offset: true }),
    baselineSnapshotId: z.string(),
    card: StoredCardSchema,
    attendees: z.array(z.enum(ATTENDEE_CATEGORIES)).optional(),
  })
  .strict();

export type SavedEventRecord = z.infer<typeof SavedEventRecordSchema>;
