/**
 * ING-7 / ING-12: GET /api/locations[?search=]
 *
 * Returns all known locations from the latest trend snapshot, augmented with
 * gazetteer cities. When ?search= is provided, filters case-insensitively on
 * locationName, city, or province (ING-12).
 *
 * Every response includes snapshotId, sampleWeek, and sourceUrl.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  readTrendLatest,
  latestMeta,
  deriveLocations,
} from "@/server/normalized-data";
import type { ApiEnvelope, LocationEntry } from "@/evidence/types";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  search: z.string().optional(),
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

  const { search } = parsed.data;
  const observations = readTrendLatest();
  const meta = latestMeta(observations);
  const locations = deriveLocations(observations, search);

  const envelope: ApiEnvelope<LocationEntry[]> = {
    snapshotId: meta.snapshotId,
    sampleWeek: meta.sampleWeek,
    sourceUrl: meta.sourceUrl,
    data: locations,
  };

  return NextResponse.json(envelope);
}
