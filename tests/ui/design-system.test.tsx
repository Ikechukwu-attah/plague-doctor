import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LevelBadge } from "../../src/components/design-system/LevelBadge";
import { TrendGlyph } from "../../src/components/design-system/TrendGlyph";
import { FreshnessLantern } from "../../src/components/design-system/FreshnessLantern";
import { ThreeClocks } from "../../src/components/design-system/ThreeClocks";
import { Notice } from "../../src/components/design-system/Notice";
import { Skeleton } from "../../src/components/design-system/Skeleton";
import { UNKNOWN_REASONS, unknownReason } from "../../src/ui-copy/unknown-reasons";
import { textOf } from "./helpers";
import type { FreshnessLabel } from "../../src/evidence/card-types";

describe("UI-1.4 UI-1.5 LevelBadge markup", () => {
  it("renders icon + word for each known level", () => {
    for (const [a, w] of [["high", "High"], ["moderate", "Moderate"], ["low", "Low"], ["not_detected", "Not detected"]] as const) {
      const html = renderToStaticMarkup(<LevelBadge activity={a} />);
      expect(textOf(html)).toContain(w);
      expect(html).toContain(`data-activity="${a}"`);
    }
  });
  it("renders hatched 'No data' for every unknown reason, never a level word", () => {
    for (const r of UNKNOWN_REASONS) {
      const html = renderToStaticMarkup(<LevelBadge activity="unknown" reason={r} />);
      expect(html).toContain("No data");
      expect(html).toContain('data-activity="unknown"');
      expect(html).not.toContain("--level-");
      expect(textOf(html)).toContain(unknownReason(r));
    }
  });
});

describe("UI-1.6 TrendGlyph markup", () => {
  it("renders glyph and word", () => {
    expect(textOf(renderToStaticMarkup(<TrendGlyph trend="increasing" />))).toContain("Increasing");
    expect(textOf(renderToStaticMarkup(<TrendGlyph trend="unknown" />))).toContain("Unknown");
  });
});

describe("UI-1.7 FreshnessLantern markup", () => {
  const cases: Array<[FreshnessLabel, string, string]> = [
    ["latest_available", "bright", "Latest available"],
    ["delayed", "dim", "Delayed"],
    ["outdated", "out", "Outdated"],
    ["no_data", "none", "No data"],
  ];
  for (const [label, brightness, text] of cases) {
    it(`${label} -> ${brightness}`, () => {
      const html = renderToStaticMarkup(<FreshnessLantern label={label} />);
      expect(html).toContain(`data-lantern="${brightness}"`);
      expect(textOf(html)).toContain(text);
    });
  }
});

describe("UI-1.9 ThreeClocks markup", () => {
  it("shows week of, PHAC file updated, our last successful ingest", () => {
    const t = textOf(
      renderToStaticMarkup(
        <ThreeClocks clocks={{ sampleWeek: "2026-10-18", phacFileUpdated: "2026-10-28", ourLastIngest: "2026-10-29T14:00:00.000Z" }} />,
      ),
    );
    expect(t).toContain("week of Oct 18, 2026");
    expect(t).toContain("PHAC file updated Oct 28, 2026");
    expect(t).toContain("Our last successful ingest Oct 29, 2026");
    expect(t).not.toMatch(/sampled on/i);
  });
  it("shows 'unavailable' for missing values", () => {
    const t = textOf(renderToStaticMarkup(<ThreeClocks clocks={{}} />));
    expect(t.match(/unavailable/g)).toHaveLength(3);
  });
});

describe("UI-12.5 Notice and Skeleton", () => {
  it("error notice is an alert; caution is a status with a visible icon", () => {
    expect(renderToStaticMarkup(<Notice tone="error">x</Notice>)).toContain('role="alert"');
    expect(renderToStaticMarkup(<Notice tone="caution">x</Notice>)).toContain('role="status"');
  });
  it("skeleton exposes a loading label and no values", () => {
    const html = renderToStaticMarkup(<Skeleton variant="rows" rows={4} />);
    expect(html).toContain('aria-busy="true"');
    expect(textOf(html)).toBe("Loading");
  });
});
