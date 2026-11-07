/**
 * UI-18.1 / UI-6.1 / UI-16.2 (D1): GET /api/history, using real normalized history.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/history/route";
import { AGGREGATE_SOURCE_URL } from "@/evidence/copy/sources";
import type { ApiEnvelope, MeasuredWeek } from "@/evidence/types";

function call(qs: string) {
  return GET(new NextRequest(`http://localhost/api/history?${qs}`));
}

async function ok(qs: string): Promise<ApiEnvelope<MeasuredWeek[]>> {
  const res = await call(qs);
  expect(res.status).toBe(200);
  return (await res.json()) as ApiEnvelope<MeasuredWeek[]>;
}

describe("GET /api/history (UI-18.1)", () => {
  it("400 when locationId or pathogen missing, or pathogen/date invalid", async () => {
    expect((await call("pathogen=fluA")).status).toBe(400);
    expect((await call("locationId=toronto")).status).toBe(400);
    expect((await call("locationId=toronto&pathogen=measles")).status).toBe(400);
    expect((await call("locationId=toronto&pathogen=fluA&from=2024-1-1")).status).toBe(400);
  });

  it("404 for an unknown location", async () => {
    const res = await call("locationId=atlantis-nowhere&pathogen=fluA");
    expect(res.status).toBe(404);
  });

  it("200 with empty data for a known location without a history file (Ottawa)", async () => {
    const body = await ok("locationId=ottawa&pathogen=fluA");
    expect(body.data).toEqual([]);
    expect(body.sourceUrl).toBe(AGGREGATE_SOURCE_URL);
  });

  it("returns rows sorted ascending, matching locationId and pathogen", async () => {
    const body = await ok("locationId=toronto&pathogen=fluA");
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.sourceUrl).toBe(AGGREGATE_SOURCE_URL);
    const dates = body.data.map((w) => w.weekStart);
    expect(dates).toEqual([...dates].sort());
    for (const w of body.data) {
      expect(w.locationId).toBe("toronto");
      expect(w.pathogen).toBe("fluA");
    }
  });

  it("filters from/to inclusively", async () => {
    const all = (await ok("locationId=toronto&pathogen=fluA")).data;
    const from = all[2]!.weekStart;
    const to = all[5]!.weekStart;
    const body = await ok(`locationId=toronto&pathogen=fluA&from=${from}&to=${to}`);
    expect(body.data.map((w) => w.weekStart)).toEqual(
      all.slice(2, 6).map((w) => w.weekStart)
    );
  });
});
