import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Reads the REAL data/normalized/index.json (read-only).
const index = JSON.parse(
  readFileSync(join(process.cwd(), "data", "normalized", "index.json"), "utf-8")
) as Array<{ sourceUrl: string; status: string; rowCount: number }>;

describe("real snapshot index is clean (UI-18.5)", () => {
  it("UI-18.5 has at least one entry", () => {
    expect(index.length).toBeGreaterThan(0);
  });

  it("UI-18.5 has no example.com entries", () => {
    expect(index.filter((e) => new URL(e.sourceUrl).host === "example.com")).toEqual([]);
  });

  it("UI-18.5 every valid entry has rowCount > 0", () => {
    for (const e of index.filter((x) => x.status === "valid")) {
      expect(e.rowCount).toBeGreaterThan(0);
    }
  });
});
