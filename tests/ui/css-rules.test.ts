/**
 * UI-1.1 UI-1.2 UI-1.3 UI-1.11 UI-3.12 UI-3.13 UI-13.5 UI-13.6
 * Static checks over src/app/globals.css and the font files.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const root = process.cwd();
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");

function token(name: string): string | undefined {
  const m = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m?.[1]?.trim();
}

describe("UI-1.1 colour tokens (§5A)", () => {
  const expected: Record<string, string> = {
    "--ink-900": "#0b1020",
    "--ink-800": "#121a30",
    "--ink-700": "#1c2742",
    "--parchment": "#eadfc8",
    "--parchment-dim": "#b9ae98",
    "--lantern": "#f2b544",
    "--fog-teal": "#5fd3bc",
    "--replay": "#b79cff",
    "--level-high": "#e0664f",
    "--level-moderate": "#e9a84a",
    "--level-low": "#7fb7a4",
    "--level-nd": "#8c93a8",
    "--level-unknown": "#5a6178",
  };
  for (const [name, hex] of Object.entries(expected)) {
    it(`UI-1.1 ${name} is ${hex}`, () => {
      expect(token(name)?.toLowerCase()).toBe(hex);
    });
  }
  it("UI-1.1 unknown level has a hatch gradient", () => {
    expect(css).toMatch(/--hatch:\s*repeating-linear-gradient/);
  });
});

describe("UI-1.3 type scale, spacing, radii (C5, C6)", () => {
  it("defines the six-step scale 12/14/16/20/28/40", () => {
    const px = { 12: "0.75rem", 14: "0.875rem", 16: "1rem", 20: "1.25rem", 28: "1.75rem", 40: "2.5rem" };
    for (const [n, rem] of Object.entries(px)) expect(token(`--text-${n}`)).toBe(rem);
    expect(css).not.toMatch(/--text-(34|42|44|46)/);
  });
  it("defines 4-px spacing steps", () => {
    for (const [n, v] of Object.entries({ 1: "4px", 2: "8px", 3: "12px", 4: "16px", 6: "24px", 8: "32px", 12: "48px" })) {
      expect(token(`--space-${n}`)).toBe(v);
    }
  });
  it("defines radii 6/12/20 and pill", () => {
    expect(token("--radius-input")).toBe("6px");
    expect(token("--radius-panel")).toBe("12px");
    expect(token("--radius-card")).toBe("20px");
    expect(token("--radius-pill")).toBe("999px");
  });
});

describe("UI-13.5 focus ring and targets", () => {
  it("uses a 3 px lantern focus ring on :focus-visible", () => {
    expect(token("--focus-ring-width")).toBe("3px");
    expect(token("--focus-ring")).toContain("var(--lantern)");
    expect(css).toMatch(/:focus-visible\s*{[^}]*outline:\s*var\(--focus-ring\)/);
  });
  it("sets 44 px minimum target", () => {
    expect(token("--target-min")).toBe("44px");
  });
});

describe("UI-3.12 UI-3.13 UI-13.6 motion", () => {
  it("fog drift duration is within 12-20 s", () => {
    const m = token("--fog-drift-duration")?.match(/^(\d+(?:\.\d+)?)s$/);
    expect(m).toBeTruthy();
    const s = Number(m?.[1]);
    expect(s).toBeGreaterThanOrEqual(12);
    expect(s).toBeLessThanOrEqual(20);
  });
  it("density eases over 600 ms", () => {
    expect(token("--fog-density-ease")).toBe("600ms ease");
  });
  it("has a prefers-reduced-motion block that stops drift", () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*$/)?.[0] ?? "";
    expect(block).toMatch(/\.fog-drift\s*{[^}]*animation:\s*none/);
    expect(block).toMatch(/transition-duration/);
  });
});

describe("UI-1.2 fonts (K7)", () => {
  it("font files and OFL licences are committed", () => {
    for (const f of [
      "CormorantGaramond-600.woff2",
      "Inter-variable.woff2",
      "JetBrainsMono-500.woff2",
      "OFL-CormorantGaramond.txt",
      "OFL-Inter.txt",
      "OFL-JetBrainsMono.txt",
    ]) {
      expect(existsSync(join(root, "src/app/fonts", f)), f).toBe(true);
    }
  });
  it("layout uses next/font/local, en-CA, skip link target main#content", () => {
    const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
    expect(layout).toContain("next/font/local");
    expect(layout).not.toContain("next/font/google");
    expect(layout).toContain('lang="en-CA"');
    const shell = readFileSync(join(root, "src/components/shell/AppShell.tsx"), "utf8");
    expect(shell).toContain('id="content"');
  });
});
