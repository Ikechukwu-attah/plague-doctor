/**
 * ING-5: Trend parser unit tests.
 * Uses real PHAC fixture — values are verbatim from the source file.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseTrend, slugify } from "@/server/ingest/parse-trend";

const FIXTURE_PATH = join(process.cwd(), "fixtures", "trend-oct-2026.real.csv");
const FAKE_SNAPSHOT_ID = "a".repeat(64);
const FAKE_SOURCE_URL =
  "https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv";

function loadFixture(): Buffer {
  return readFileSync(FIXTURE_PATH);
}

describe("ING-5: parseTrend — real fixture (trend-oct-2026)", () => {
  it("parses all expected rows without error", () => {
    const bytes = loadFixture();
    const result = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.rejectedRows).toBe(0);
  });

  it("Toronto covN2 — activityIndex = high (verbatim from PHAC file)", () => {
    const bytes = loadFixture();
    const { observations } = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    const toronto = observations.find(
      (o) => o.city === "Toronto" && o.pathogen === "covid19"
    );
    expect(toronto).toBeDefined();
    // Verbatim PHAC value: Viral_Activity_Level = High
    expect(toronto?.activityIndex).toBe("high");
    expect(toronto?.grouping).toBe("city");
    expect(toronto?.weekStart).toBe("2026-10-18");
    expect(toronto?.interpretationMethod).toBe("publisher");
  });

  it("Toronto fluA — activityIndex = moderate, trend = stable", () => {
    const bytes = loadFixture();
    const { observations } = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    const row = observations.find(
      (o) => o.city === "Toronto" && o.pathogen === "fluA"
    );
    expect(row?.activityIndex).toBe("moderate");
    expect(row?.trend).toBe("stable"); // No Change → stable
  });

  it("Toronto fluB — activityIndex = not_detected", () => {
    const bytes = loadFixture();
    const { observations } = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    const row = observations.find(
      (o) => o.city === "Toronto" && o.pathogen === "fluB"
    );
    expect(row?.activityIndex).toBe("not_detected");
  });

  it("Fredericton fluA — NA1: activityIndex = unknown, unknownReason = na1_new_site", () => {
    const bytes = loadFixture();
    const { observations } = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    const row = observations.find(
      (o) => o.locationName === "Fredericton" && o.pathogen === "fluA"
    );
    expect(row?.activityIndex).toBe("unknown");
    expect(row?.unknownReason).toBe("na1_new_site");
    // NA1 coexists with valid latestLevel (Fredericton fluA = Moderate per PHAC)
    expect(row?.signalLevel).toBe("moderate");
  });

  it("Fredericton covN2 — activityIndex = moderate (not NA)", () => {
    const bytes = loadFixture();
    const { observations } = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    const row = observations.find(
      (o) => o.locationName === "Fredericton" && o.pathogen === "covid19"
    );
    expect(row?.activityIndex).toBe("moderate");
    expect(row?.unknownReason).toBeUndefined();
  });

  it("Cape Breton Regional Municipality — NA2: activityIndex = unknown / na2_not_sampling", () => {
    const bytes = loadFixture();
    const { observations } = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    const row = observations.find(
      (o) =>
        o.locationName === "Cape Breton Regional Municipality" &&
        o.pathogen === "covid19"
    );
    expect(row?.activityIndex).toBe("unknown");
    expect(row?.unknownReason).toBe("na2_not_sampling");
  });

  it("Halifax Millcove — NA2 site with No Recent Data trend", () => {
    const bytes = loadFixture();
    const { observations } = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    const row = observations.find(
      (o) => o.locationName === "Halifax Millcove" && o.pathogen === "covid19"
    );
    expect(row?.activityIndex).toBe("unknown");
    expect(row?.unknownReason).toBe("na2_not_sampling");
    expect(row?.trend).toBe("unknown");
  });

  it("Ontario is grouping = province", () => {
    const bytes = loadFixture();
    const { observations } = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    const row = observations.find(
      (o) => o.locationName === "Ontario" && o.pathogen === "covid19"
    );
    expect(row?.grouping).toBe("province");
  });

  it("Canada is grouping = national", () => {
    const bytes = loadFixture();
    const { observations } = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    const row = observations.find(
      (o) => o.locationName === "Canada" && o.pathogen === "covid19"
    );
    expect(row?.grouping).toBe("national");
  });

  it("snapshotId and sourceUrl are set on every record", () => {
    const bytes = loadFixture();
    const { observations } = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    for (const obs of observations) {
      expect(obs.snapshotId).toBe(FAKE_SNAPSHOT_ID);
      expect(obs.sourceUrl).toBe(FAKE_SOURCE_URL);
    }
  });

  it("interpretationMethod is always 'publisher'", () => {
    const bytes = loadFixture();
    const { observations } = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    for (const obs of observations) {
      expect(obs.interpretationMethod).toBe("publisher");
    }
  });

  it("ING-5/P2: activityIndex is never 'low' or 'not_detected' for NA rows", () => {
    const bytes = loadFixture();
    const { observations } = parseTrend(bytes, "trend-oct-2026", FAKE_SNAPSHOT_ID, FAKE_SOURCE_URL);
    for (const obs of observations) {
      if (obs.unknownReason) {
        expect(obs.activityIndex).toBe("unknown");
        expect(obs.activityIndex).not.toBe("low");
        expect(obs.activityIndex).not.toBe("not_detected");
      }
    }
  });
});

describe("ING-5: slugify", () => {
  it("produces deterministic locationId", () => {
    expect(slugify("Toronto")).toBe("toronto");
    expect(slugify("Halifax Halifax")).toBe("halifax-halifax");
    expect(slugify("Cape Breton Regional Municipality")).toBe(
      "cape-breton-regional-municipality"
    );
  });

  it("is stable across calls", () => {
    expect(slugify("Ontario")).toBe(slugify("Ontario"));
  });
});
