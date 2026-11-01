/**
 * ING-7: GET /api/observations?locationId&pathogen&from&to
 * Returns StatusObservation[] filtered by params.
 * All params Zod-validated; 400 on invalid, 404 on unknown locationId.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  readTrendLatest,
  latestMeta,
} from "@/server/normalized-data";
import type { ApiEnvelope, StatusObservation } from "@/evidence/types";
import { PathogenSchema } from "@/evidence/schemas";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  locationId: z.string().min(1).optional(),
  pathogen: PathogenSchema.optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD")
    .optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { locationId, pathogen, from, to } = parsed.data;

  let observations = readTrendLatest();

  if (locationId) {
    observations = observations.filter((o) => o.locationId === locationId);
    if (observations.length === 0) {
      return NextResponse.json(
        { error: "Location not found", locationId },
        { status: 404 }
      );
    }
  }

  if (pathogen) {
    observations = observations.filter((o) => o.pathogen === pathogen);
  }

  if (from) {
    observations = observations.filter((o) => o.weekStart >= from);
  }

  if (to) {
    observations = observations.filter((o) => o.weekStart <= to);
  }

  const meta = latestMeta(observations.length > 0 ? observations : readTrendLatest());
  const envelope: ApiEnvelope<StatusObservation[]> = {
    snapshotId: meta.snapshotId,
    sampleWeek: meta.sampleWeek,
    sourceUrl: meta.sourceUrl,
    data: observations,
  };

  return NextResponse.json(envelope);
}
