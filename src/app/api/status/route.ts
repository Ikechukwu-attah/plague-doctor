/**
 * ING-7 / ING-8 / ING-11: GET /api/status?locationId
 *
 * Returns the latest StatusObservation for each pathogen at the requested location.
 *
 * Resolution order (ING-11):
 * 1. PHAC data — returns real observations
 * 2. Gazetteer city — returns 200 with coverage "no_city_site" + province aggregate,
 *    empty observations. Never substitutes another city's values.
 * 3. Unknown slug — returns 404.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  readTrendLatest,
  latestMeta,
  resolveLocation,
} from "@/server/normalized-data";
import type {
  ApiEnvelope,
  StatusObservation,
  LocationEntry,
} from "@/evidence/types";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  locationId: z.string().min(1),
});

interface StatusResponse {
  location: LocationEntry;
  coverage: string;
  observations: StatusObservation[];
  provinceAggregate?: {
    location: LocationEntry;
    observations: StatusObservation[];
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "locationId is required", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { locationId } = parsed.data;
  const allObservations = readTrendLatest();
  const meta = latestMeta(allObservations);

  // resolveLocation: checks PHAC data, then gazetteer, then null
  const location = resolveLocation(locationId, allObservations);

  if (!location) {
    return NextResponse.json(
      { error: "Location not found", locationId },
      { status: 404 }
    );
  }

  const observations = allObservations.filter(
    (o) => o.locationId === locationId
  );

  const response: StatusResponse = {
    location,
    coverage: location.coverage,
    observations,
  };

  // For no_city_site: attach province aggregate observations
  if (location.coverage === "no_city_site" && location.provinceAggregate) {
    const provId = location.provinceAggregate.locationId;
    const provObs = allObservations.filter((o) => o.locationId === provId);
    response.provinceAggregate = {
      location: location.provinceAggregate,
      observations: provObs,
    };
  }

  const envelope: ApiEnvelope<StatusResponse> = {
    snapshotId: meta.snapshotId,
    sampleWeek: meta.sampleWeek,
    sourceUrl: meta.sourceUrl,
    data: response,
  };

  return NextResponse.json(envelope);
}
