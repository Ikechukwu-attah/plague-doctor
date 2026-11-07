import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseTrend } from "../../src/server/ingest/parse-trend";
import { lookupCity } from "../../src/server/geo/cities";
import { resolveCoverage } from "../../src/evidence/coverage";
import type { StatusObservation } from "../../src/evidence/types";

let obs: StatusObservation[] = [];

// StatusObservationSchema requires snapshotId to be a 64-char sha256 hex string.
const TEST_SNAPSHOT_ID = "a".repeat(64);

beforeAll(() => {
  const bytes = readFileSync(join(process.cwd(), "fixtures/trend-oct-2026.real.csv"));
  const result = parseTrend(
    bytes,
    "trend-oct-2026",
    TEST_SNAPSHOT_ID,
    "https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv",
  );
  obs = result.observations;
});

describe("EVD-2: Coverage resolver", () => {
  it("Toronto → city_site (has city grouping row in fixture)", () => {
    const city = lookupCity("toronto");
    expect(city).not.toBeNull();
    const result = resolveCoverage("toronto", obs, true, city!.pruid);
    expect(result.coverage).toBe("city_site");
  });

  it("Halifax site location → site_only or city_site depending on fixture grouping", () => {
    const hhRows = obs.filter((o) => o.locationId === "halifax-halifax");
    const hasCity = hhRows.some((o) => o.grouping === "city");
    const result = resolveCoverage("halifax-halifax", obs, true, "12");
    expect(result.coverage).toBe(hasCity ? "city_site" : "site_only");
  });

  it("Ottawa → no_city_site with Ontario (pruid 35) province aggregate", () => {
    const city = lookupCity("ottawa");
    expect(city).not.toBeNull();
    const result = resolveCoverage("ottawa", obs, true, city!.pruid);
    expect(result.coverage).toBe("no_city_site");
    if (result.coverage === "no_city_site" && result.regional) {
      expect(result.regional.grouping).toBe("province");
      expect(result.regional.pruid).toBe("35");
    } else {
      throw new Error("expected Ontario province aggregate for Ottawa");
    }
  });

  it("unknown locationId (not Gazetteer, not PHAC) → unknown", () => {
    const result = resolveCoverage("atlantis-canada", obs, false, undefined);
    expect(result.coverage).toBe("unknown");
  });

  it("Gazetteer city, no rows, no province aggregate → no_city_site + aggregate_below_coverage", () => {
    const result = resolveCoverage("ottawa", [], true, "35");
    expect(result.coverage).toBe("no_city_site");
    if (result.coverage === "no_city_site") {
      expect(result.unknownReason).toBe("aggregate_below_coverage");
    }
  });

  it("Charlottetown is a known Gazetteer city (PEI)", () => {
    const city = lookupCity("charlottetown");
    expect(city).not.toBeNull();
    expect(city!.province).toBe("Prince Edward Island");
  });
});
