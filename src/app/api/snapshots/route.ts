/**
 * ING-7: GET /api/snapshots
 * Returns all snapshot metadata from the index.
 */
import { NextResponse } from "next/server";
import { readIndex, readTrendLatest, latestMeta } from "@/server/normalized-data";
import type { ApiEnvelope, SourceSnapshot } from "@/evidence/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const index = readIndex();
  const observations = readTrendLatest();
  const meta = latestMeta(observations);

  const envelope: ApiEnvelope<SourceSnapshot[]> = {
    snapshotId: meta.snapshotId,
    sampleWeek: meta.sampleWeek,
    sourceUrl: meta.sourceUrl,
    data: index,
  };

  return NextResponse.json(envelope);
}
