/**
 * UI-13.9 / design C20: WCAG contrast from the token table.
 * 4.5:1 for text pairs, 3:1 for graphics. Token values are read from globals.css.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function hex(name: string): string {
  const m = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!m?.[1]) throw new Error(`token ${name} not found`);
  return m[1];
}

function lum(h: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

const T = (n: string) => hex(`--${n}`);

// Text pairs: foreground on background, >= 4.5
const TEXT_PAIRS: Array<[string, string]> = [
  ["parchment", "ink-900"],
  ["parchment", "ink-800"],
  ["parchment", "ink-700"],
  ["parchment-dim", "ink-900"],
  ["parchment-dim", "ink-800"],
  ["parchment-dim", "ink-700"],
  ["lantern", "ink-900"],
  ["lantern", "ink-800"],
  ["ink-900", "lantern"], // primary button, selected chip
  ["level-nd", "ink-800"], // disabled/secondary text
  ["level-nd", "ink-900"],
];

// Graphic pairs (glyphs paired with a word), >= 3
const GRAPHIC_PAIRS: Array<[string, string]> = [
  ["level-high", "ink-800"], // badge background is ink-800 (C20)
  ["level-moderate", "ink-800"],
  ["level-low", "ink-800"],
  ["level-nd", "ink-800"],
  ["level-unknown-stroke", "ink-800"], // hatch stroke
  ["level-unknown-stroke", "ink-700"],
  ["lantern", "ink-700"],
  ["lantern-delayed", "ink-700"],
  ["replay", "ink-900"],
  ["fog-teal", "ink-900"],
];

describe("UI-13.9 contrast (C20)", () => {
  for (const [fg, bg] of TEXT_PAIRS) {
    it(`UI-13.9 text ${fg} on ${bg} >= 4.5:1`, () => {
      expect(ratio(T(fg), T(bg))).toBeGreaterThanOrEqual(4.5);
    });
  }
  for (const [fg, bg] of GRAPHIC_PAIRS) {
    it(`UI-13.9 graphic ${fg} on ${bg} >= 3:1`, () => {
      expect(ratio(T(fg), T(bg))).toBeGreaterThanOrEqual(3);
    });
  }

  it("C20 documented values hold", () => {
    // level-high on ink-700 is below 4.5 and so is never used for text there
    expect(ratio(T("level-high"), T("ink-700"))).toBeLessThan(4.5);
    expect(ratio(T("level-high"), T("ink-800"))).toBeGreaterThan(4.9);
    // hatch stroke
    expect(ratio(T("level-unknown-stroke"), T("ink-900"))).toBeGreaterThan(6);
    // Omen Card dark glyph on parchment passes as a 3:1 graphic only
    const g = ratio(T("paper-glyph-dark"), T("parchment"));
    expect(g).toBeGreaterThanOrEqual(3);
    expect(g).toBeLessThan(4.5);
    // The unknown fill is not valid as text on ink-800
    expect(ratio(T("level-unknown"), T("ink-800"))).toBeLessThan(3);
  });

  it("UI-1.7 extinguished lantern outline (hatch stroke on ink-700) is >= 3:1; --level-unknown is not", () => {
    expect(ratio(T("level-unknown-stroke"), T("ink-700"))).toBeGreaterThanOrEqual(3);
    expect(ratio(T("level-unknown"), T("ink-700"))).toBeLessThan(3);
  });
  it("ratio helper matches a known value (white on black = 21)", () => {
    expect(ratio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });
});
