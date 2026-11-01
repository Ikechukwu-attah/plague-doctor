/**
 * ING-7: GET /api/data-status
 * Returns ingestion health: last successful fetch, snapshot count,
 * latest sample week per pathogen, schema version.
 */
import { NextResponse } from "next/server";
import { readTrendLatest, readIndex, latestMeta } from "@/server/normalized-data";
import type { ApiEnvelope } from "@/evidence/types";

export const dynamic = "force-dynamic";

interface DataStatus {
  snapshotCount: number;
  lastSuccessfulFetch: string | null;
  latestSampleWeekByPathogen: Record<string, string>;
  schemaVersion: string | null;
  trendSnapshotId: string | null;
}

export async function GET(): Promise<NextResponse> {
  const observations = readTrendLatest();
  const index = readIndex();
  const meta = latestMeta(observations);

  // Latest sample week per pathogen
  const latestByPathogen: Record<string, string> = {};
  for (const obs of observations) {
    const current = latestByPathogen[obs.pathogen];
    if (!current || obs.weekStart > current) {
      latestByPathogen[obs.pathogen] = obs.weekStart;
    }
  }

  // Last successful ingest
  const validSnapshots = index
    .filter((s) => s.status === "valid")
    .sort(
      (a, b) =>
        new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
    );

  const latest = validSnapshots[0];

  const status: DataStatus = {
    snapshotCount: validSnapshots.length,
    lastSuccessfulFetch: latest?.fetchedAt ?? null,
    latestSampleWeekByPathogen: latestByPathogen,
    schemaVersion: latest?.schemaVersion ?? null,
    trendSnapshotId: meta.snapshotId || null,
  };

  const envelope: ApiEnvelope<DataStatus> = {
    snapshotId: meta.snapshotId,
    sampleWeek: meta.sampleWeek,
    sourceUrl: meta.sourceUrl,
    data: status,
  };

  return NextResponse.json(envelope);
}
