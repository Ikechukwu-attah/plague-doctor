/**
 * ING-3: Schema registry unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  fingerprintColumns,
  detectSchema,
  getSchemaByVersion,
} from "@/server/ingest/schema-registry";

const TREND_OCT_2026_HEADERS = [
  "Location","measureid","latestTrend","pruid","min","max",
  "latestLevel","grouping","city","province","country",
  "Viral_Activity_Level","weekStart",
];

const TREND_DEC_2025_HEADERS = [
  "Location","measureid","latestTrend","pruid","t_low","t_high",
  "latestLevel","grouping","city","province","country",
  "Viral_Activity_Level","weekStart",
];

const AGGREGATE_V1_HEADERS = [
  "Location","site","city","province","country",
  "EpiYear","EpiWeek","weekstart","measureid",
  "w_avg","min","max","populationcoverage","pruid",
];

describe("ING-3: fingerprintColumns", () => {
  it("produces same fingerprint regardless of column order", () => {
    const fp1 = fingerprintColumns(TREND_OCT_2026_HEADERS);
    const fp2 = fingerprintColumns([...TREND_OCT_2026_HEADERS].reverse());
    const fp3 = fingerprintColumns(
      [...TREND_OCT_2026_HEADERS].sort(() => Math.random() - 0.5)
    );
    expect(fp1).toBe(fp2);
    expect(fp1).toBe(fp3);
  });

  it("produces different fingerprints for different column sets", () => {
    expect(fingerprintColumns(TREND_OCT_2026_HEADERS)).not.toBe(
      fingerprintColumns(TREND_DEC_2025_HEADERS)
    );
  });
});

describe("ING-3: detectSchema", () => {
  it("detects trend-oct-2026 with columns in canonical order", () => {
    const schema = detectSchema("trend", TREND_OCT_2026_HEADERS);
    expect(schema?.versionId).toBe("trend-oct-2026");
  });

  it("ING-3: reordered known headers → same schema detected", () => {
    const shuffled = [...TREND_OCT_2026_HEADERS].sort(
      (a, b) => a.localeCompare(b)
    );
    const schema = detectSchema("trend", shuffled);
    expect(schema?.versionId).toBe("trend-oct-2026");
  });

  it("detects trend-dec-2025 (t_low/t_high variant)", () => {
    const schema = detectSchema("trend", TREND_DEC_2025_HEADERS);
    expect(schema?.versionId).toBe("trend-dec-2025");
  });

  it("detects aggregate-v1", () => {
    const schema = detectSchema("aggregate", AGGREGATE_V1_HEADERS);
    expect(schema?.versionId).toBe("aggregate-v1");
  });

  it("returns null when a required column is renamed", () => {
    const renamed = TREND_OCT_2026_HEADERS.map((h) =>
      h === "Viral_Activity_Level" ? "viral_activity_level_renamed" : h
    );
    expect(detectSchema("trend", renamed)).toBeNull();
  });

  it("returns null when an extra unexpected column is added", () => {
    const extra = [...TREND_OCT_2026_HEADERS, "mystery_column"];
    expect(detectSchema("trend", extra)).toBeNull();
  });

  it("returns null when a required column is missing", () => {
    const missing = TREND_OCT_2026_HEADERS.filter((h) => h !== "weekStart");
    expect(detectSchema("trend", missing)).toBeNull();
  });

  it("returns null for trend headers tested against aggregate file type", () => {
    expect(detectSchema("aggregate", TREND_OCT_2026_HEADERS)).toBeNull();
  });
});

describe("ING-3: getSchemaByVersion", () => {
  it("returns the correct schema for a known version", () => {
    const schema = getSchemaByVersion("trend-oct-2026");
    expect(schema?.versionId).toBe("trend-oct-2026");
    expect(schema?.fileType).toBe("trend");
  });

  it("returns undefined for an unknown version", () => {
    expect(getSchemaByVersion("trend-jan-2020")).toBeUndefined();
  });
});
