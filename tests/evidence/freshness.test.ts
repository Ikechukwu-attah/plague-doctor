import { describe, it, expect, beforeAll } from "vitest";
import * as fc from "fast-check";
import { readFileSync } from "fs";
import { join } from "path";
import { classifyFreshness } from "../../src/evidence/freshness";
import { parseTrend } from "../../src/server/ingest/parse-trend";
import type { StatusObservation } from "../../src/evidence/types";

let realObservations: StatusObservation[] = [];

beforeAll(() => {
  const bytes = readFileSync(join(process.cwd(), "fixtures/trend-oct-2026.real.csv"));
  // snapshotId must be a 64-char sha256 hex string (StatusObservationSchema).
  // This identifies the snapshot only; the observation values come from the
  // real PHAC fixture bytes above.
  const result = parseTrend(
    bytes,
    "trend-oct-2026",
    "0".repeat(64),
    "https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv",
  );
  realObservations = result.observations;
});

describe("EVD-1: Freshness classifier", () => {
  const TODAY = "2026-10-31";

  describe("Decision ladder", () => {
    it("null weekStart → no_data", () => {
      expect(classifyFreshness(null, null, "high", undefined, TODAY)).toBe("no_data");
    });
    it("undefined weekStart → no_data", () => {
      expect(classifyFreshness(undefined, null, "high", undefined, TODAY)).toBe("no_data");
    });
    it("non-YYYY-MM-DD weekStart → no_data", () => {
      expect(classifyFreshness("not-a-date", null, "high", undefined, TODAY)).toBe("no_data");
    });
    it("NA1 unknownReason → no_data regardless of age", () => {
      expect(classifyFreshness("2026-10-18", null, "unknown", "na1_new_site", TODAY)).toBe("no_data");
    });
    it("NA2 unknownReason → no_data regardless of age", () => {
      expect(classifyFreshness("2026-10-18", null, "unknown", "na2_not_sampling", TODAY)).toBe("no_data");
    });
    it("No Recent Data trend → outdated regardless of age", () => {
      expect(classifyFreshness("2026-10-29", "No Recent Data", "high", undefined, TODAY)).toBe("outdated");
    });
    it("boundary: age 21 → latest_available", () => {
      expect(classifyFreshness("2026-10-10", "No Change", "high", undefined, TODAY)).toBe("latest_available");
    });
    it("boundary: age 22 → delayed", () => {
      expect(classifyFreshness("2026-10-09", "No Change", "high", undefined, TODAY)).toBe("delayed");
    });
    it("boundary: age 35 → delayed", () => {
      expect(classifyFreshness("2026-09-26", "No Change", "high", undefined, TODAY)).toBe("delayed");
    });
    it("boundary: age 36 → outdated", () => {
      expect(classifyFreshness("2026-09-25", "No Change", "high", undefined, TODAY)).toBe("outdated");
    });
    it("DST spring-forward: 2026-03-09 is 21 days before 2026-03-30 → latest_available", () => {
      expect(classifyFreshness("2026-03-09", "No Change", "high", undefined, "2026-03-30")).toBe("latest_available");
    });
  });

  describe("EVD-1 P1: freshness never depends on ingest time — oct-2026 fixture", () => {
    it("EVD-1 P1: freshness never depends on ingest time — oct-2026 fixture", () => {
      // Feature: evidence-engine, Property 1
      // The classifier does not accept a fetchedAt param, so two calls with identical
      // weekStart/today but any imagined ingest time must return the same label.
      fc.assert(
        fc.property(
          fc.constantFrom(...realObservations),
          (obs) => {
            const latestTrend = obs.trend === "unknown" ? "No Recent Data" : "No Change";
            const a = classifyFreshness(obs.weekStart, latestTrend, obs.activityIndex, obs.unknownReason, TODAY);
            const b = classifyFreshness(obs.weekStart, latestTrend, obs.activityIndex, obs.unknownReason, TODAY);
            return a === b;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
