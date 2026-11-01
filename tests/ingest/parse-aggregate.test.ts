/**
 * ING-15: Aggregate CSV parser tests.
 * Uses real PHAC fixture: fixtures/aggregate-oct-2026.real.csv
 * (20 Toronto rows + 16 Halifax rows = 36 data rows, verbatim from PHAC file).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseAggregate } from "@/server/ingest/parse-aggregate";
import { detectSchema } from "@/server/ingest/schema-registry";

const FIXTURE_PATH = join(
  process.cwd(),
  "fixtures",
  "aggregate-oct-2026.real.csv"
);
const FAKE_SNAPSHOT_ID = "b".repeat(64);
const AGGREGATE_URL =
  "https://health-infobase.canada.ca/src/data/wastewater/wastewater_aggregate.csv";

function loadFixture(): Buffer {
  return readFileSync(FIXTURE_PATH);
}

describe("ING-15: parseAggregate — real fixture", () => {
  it("parses exactly 36 data rows (20 Toronto + 16 Halifax)", () => {
    const bytes = loadFixture();
    const result = parseAggregate(bytes, FAKE_SNAPSHOT_ID, AGGREGATE_URL);
    expect(result.rowCount).toBe(36);
    expect(result.rejectedRows).toBe(0);
    expect(result.weeks).toHaveLength(36);
  });

  it("Toronto covN2 EpiWeek 42 — wAvg, histMin, histMax are numbers (accessed by header name)", () => {
    const bytes = loadFixture();
    const { weeks } = parseAggregate(bytes, FAKE_SNAPSHOT_ID, AGGREGATE_URL);
    // Verbatim from fixture: EpiWeek=42, covN2, wAvg=28.586619747166
    const row = weeks.find(
      (w) => w.locationName === "Toronto" && w.pathogen === "covid19" && w.epiWeek === 42
    );
    expect(row).toBeDefined();
    expect(typeof row?.wAvg).toBe("number");
    expect(typeof row?.histMin).toBe("number");
    expect(typeof row?.histMax).toBe("number");
    // Verbatim values from PHAC file
    expect(row?.wAvg).toBeCloseTo(28.586619747166, 5);
    expect(row?.histMin).toBeCloseTo(11.3056090270314, 5);
    expect(row?.histMax).toBeCloseTo(68.5236112068422, 5);
  });

  it("population coverage is parsed as a number", () => {
    const bytes = loadFixture();
    const { weeks } = parseAggregate(bytes, FAKE_SNAPSHOT_ID, AGGREGATE_URL);
    const row = weeks.find(
      (w) => w.locationName === "Toronto" && w.pathogen === "covid19"
    );
    expect(typeof row?.populationCoverage).toBe("number");
    // Verbatim from fixture: 0.759404313552031
    expect(row?.populationCoverage).toBeCloseTo(0.759404313552031, 8);
  });

  it("empty w_avg cell produces null, not zero", () => {
    // Build a synthetic CSV row with empty w_avg
    const csv = [
      "Location,site,city,province,country,EpiYear,EpiWeek,weekstart,measureid,w_avg,min,max,populationcoverage,pruid",
      "TestCity,,TestCity,Ontario,Canada,2026,42,2026-10-18,covN2,,1.0,2.0,0.5,35",
    ].join("\n");
    const { weeks } = parseAggregate(
      Buffer.from(csv),
      FAKE_SNAPSHOT_ID,
      AGGREGATE_URL
    );
    expect(weeks[0]?.wAvg).toBeNull();
    expect(weeks[0]?.wAvg).not.toBe(0);
  });

  it("'NA' value in min/max produces null, not zero", () => {
    const csv = [
      "Location,site,city,province,country,EpiYear,EpiWeek,weekstart,measureid,w_avg,min,max,populationcoverage,pruid",
      "TestCity,,TestCity,Ontario,Canada,2026,42,2026-10-18,covN2,5.0,NA,NA,0.5,35",
    ].join("\n");
    const { weeks } = parseAggregate(
      Buffer.from(csv),
      FAKE_SNAPSHOT_ID,
      AGGREGATE_URL
    );
    expect(weeks[0]?.histMin).toBeNull();
    expect(weeks[0]?.histMax).toBeNull();
  });

  it("snapshotId is set on every record", () => {
    const bytes = loadFixture();
    const { weeks } = parseAggregate(bytes, FAKE_SNAPSHOT_ID, AGGREGATE_URL);
    for (const week of weeks) {
      expect(week.snapshotId).toBe(FAKE_SNAPSHOT_ID);
    }
  });

  it("Halifax covN2 EpiWeek 42 wAvg matches real PHAC value", () => {
    const bytes = loadFixture();
    const { weeks } = parseAggregate(bytes, FAKE_SNAPSHOT_ID, AGGREGATE_URL);
    const row = weeks.find(
      (w) => w.locationName === "Halifax" && w.pathogen === "covid19" && w.epiWeek === 42
    );
    expect(row).toBeDefined();
    // Verbatim from PHAC: 1.8785530053068
    expect(row?.wAvg).toBeCloseTo(1.8785530053068, 5);
  });

  it("ING-15: unknown/extra column in header causes schema detectSchema to return null", () => {
    const AGGREGATE_HEADERS = [
      "Location","site","city","province","country",
      "EpiYear","EpiWeek","weekstart","measureid",
      "w_avg","min","max","populationcoverage","pruid",
    ];
    const withExtra = [...AGGREGATE_HEADERS, "mystery_column"];
    expect(detectSchema("aggregate", withExtra)).toBeNull();
  });

  it("values accessed by header name — shuffled column order still parses", () => {
    // Build a CSV with columns reordered but same data
    const headers = [
      "Location","site","city","province","country",
      "EpiYear","EpiWeek","weekstart","measureid",
      "w_avg","min","max","populationcoverage","pruid",
    ];
    const shuffled = [...headers].sort(); // alphabetical reordering
    const rowValues: Record<string, string> = {
      Location: "TestCity", site: "", city: "TestCity", province: "Ontario",
      country: "Canada", EpiYear: "2026", EpiWeek: "42",
      weekstart: "2026-10-18", measureid: "covN2", w_avg: "10.5",
      min: "5.0", max: "20.0", populationcoverage: "0.75", pruid: "35",
    };
    const csvRow = shuffled.map((h) => rowValues[h] ?? "").join(",");
    const csv = [shuffled.join(","), csvRow].join("\n");

    // Schema detection should still match aggregate-v1
    const schema = detectSchema("aggregate", shuffled);
    expect(schema?.versionId).toBe("aggregate-v1");

    // Parser should produce correct values regardless of column order
    const { weeks } = parseAggregate(
      Buffer.from(csv),
      FAKE_SNAPSHOT_ID,
      AGGREGATE_URL
    );
    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.wAvg).toBeCloseTo(10.5, 3);
    expect(weeks[0]?.histMin).toBeCloseTo(5.0, 3);
    expect(weeks[0]?.histMax).toBeCloseTo(20.0, 3);
    expect(weeks[0]?.epiWeek).toBe(42);
  });
});
