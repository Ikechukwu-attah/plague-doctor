/**
 * D1 / 18.1: GET /api/history?locationId&pathogen&from&to
 * Returns MeasuredWeek[] (aggregate history: measurements only, no official level),
 * sorted ascending by weekStart, from/to inclusive.
 * 400 on invalid query, 404 on unknown locationId, 200 [] when no history file.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  readTrendLatest,
  readHistory,
  resolveLocation,
  latestMeta,
} from "@/server/normalized-data";
import type { ApiEnvelope, MeasuredWeek } from "@/evidence/types";
import { PathogenSchema } from "@/evidence/schemas";
import { AGGREGATE_SOURCE_URL } from "@/evidence/copy/sources";

export const dynamic = "force-dynamic";

const DateParam = (name: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${name} must be YYYY-MM-DD`);

const QuerySchema = z.object({
  locationId: z.string().min(1),
  pathogen: PathogenSchema,
  from: DateParam("from").optional(),
  to: DateParam("to").optional(),
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

  const trend = readTrendLatest();
  if (resolveLocation(locationId, trend) === null) {
    return NextResponse.json(
      { error: "Location not found", locationId },
      { status: 404 }
    );
  }

  let weeks: MeasuredWeek[] = readHistory(locationId, pathogen)
    .filter((w) => w.locationId === locationId && w.pathogen === pathogen)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  if (from) weeks = weeks.filter((w) => w.weekStart >= from);
  if (to) weeks = weeks.filter((w) => w.weekStart <= to);

  const meta = latestMeta(trend);
  const last = weeks[weeks.length - 1];
  const envelope: ApiEnvelope<MeasuredWeek[]> = {
    snapshotId: last?.snapshotId ?? meta.snapshotId,
    sampleWeek: last?.weekStart ?? meta.sampleWeek,
    sourceUrl: AGGREGATE_SOURCE_URL,
    data: weeks,
  };

  return NextResponse.json(envelope);
}
