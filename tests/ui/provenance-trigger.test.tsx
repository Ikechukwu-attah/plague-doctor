/**
 * UI-7.1 UI-7.3 UI-13.5: the provenance "i" trigger is visible on parchment and dark surfaces.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProvenanceTrigger } from "../../src/components/city/ProvenanceTrigger";
import { buildCardView } from "../../src/lib/view/card-view";
import { TODAY, TORONTO, makeCard } from "./card-helpers";

const root = process.cwd();
const globals = readFileSync(join(root, "src/app/globals.css"), "utf8");
const cityCss = readFileSync(join(root, "src/components/city/City.module.css"), "utf8");
const cardCss = readFileSync(join(root, "src/components/card/Card.module.css"), "utf8");

function token(name: string): string {
  const m = globals.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!m?.[1]) throw new Error(`token --${name} not found`);
  return m[1];
}
function lum(h: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

function triggerMarkup(): string {
  const view = buildCardView(makeCard({ loc: TORONTO, offsetDays: 3, setting: "indoor.family-dinner", attendees: [] }), TODAY);
  if (view.timing !== "near") throw new Error("expected near card");
  const row = view.rows[0];
  if (!row) throw new Error("no near row");
  return renderToStaticMarkup(<ProvenanceTrigger model={row.provenance} />);
}

describe("UI-7.1 provenance trigger markup", () => {
  const out = triggerMarkup();
  it("is a button with a visible i glyph and an accessible name", () => {
    expect(out).toMatch(/<button[^>]*type="button"/);
    expect(out).toMatch(/aria-label="[^"]+"/);
    expect(out).toMatch(/<span aria-hidden="true"[^>]*>i<\/span>/);
  });
});

describe("UI-13.5 provenance trigger surfaces", () => {
  it("trigger styling reads surface tokens, not fixed colours", () => {
    const rule = cityCss.match(/\.provTrigger\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("var(--prov-glyph)");
    expect(rule).toContain("var(--prov-ring)");
    expect(rule).toContain("var(--target-min)");
    expect(cityCss).toMatch(/\.provTrigger:focus-visible[^{]*\{[^}]*var\(--focus-ring\)/);
  });
  it("the parchment surface overrides the tokens", () => {
    const paper = cardCss.match(/\.paper\s*\{[^}]*\}/)?.[0] ?? "";
    expect(paper).toContain("--prov-glyph: var(--prov-glyph-paper)");
    expect(paper).toContain("--prov-ring: var(--prov-ring-paper)");
  });
  it.each([
    ["parchment", "prov-glyph-paper", "prov-ring-paper"],
    ["ink-800", "prov-glyph-dark", "prov-ring-dark"],
    ["ink-900", "prov-glyph-dark", "prov-ring-dark"],
  ])("glyph and ring are at least 4.5:1 on %s", (bg, glyph, ring) => {
    expect(ratio(token(glyph), token(bg))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token(ring), token(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
