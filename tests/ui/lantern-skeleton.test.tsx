/**
 * UI-19.28 UI-19.29 UI-19.38 lantern-and-fog skeleton and mask-lift reveal.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { LanternSkeleton } from "../../src/components/design-system/LanternSkeleton";
import { Skeleton } from "../../src/components/design-system/Skeleton";
import { MaskReveal, MASK_REVEAL_MS } from "../../src/components/methods/MaskReveal";
import { textOf } from "./helpers";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const skeletonCss = read("src/components/design-system/LanternSkeleton.module.css");
const maskCss = read("src/components/methods/MaskReveal.module.css");

function rule(css: string, selector: string): string {
  const m = css.match(new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")}\\s*{([^}]*)}`));
  return m?.[1] ?? "";
}

describe("UI-19.28 LanternSkeleton markup", () => {
  for (const variant of ["lines", "rows", "card", "map"] as const) {
    it(`${variant}: aria-busy and a single visually-hidden Loading label`, () => {
      const html = renderToStaticMarkup(<LanternSkeleton variant={variant} />);
      expect(html).toContain('aria-busy="true"');
      expect(textOf(html)).toBe("Loading");
      expect(html).not.toMatch(/<svg(?![^>]*aria-hidden="true")/);
    });
  }
  it("Skeleton delegates to the lantern skeleton", () => {
    expect(renderToStaticMarkup(<Skeleton variant="card" />)).toBe(renderToStaticMarkup(<LanternSkeleton variant="card" />));
  });
  it("renders the requested number of rows and lines", () => {
    expect((renderToStaticMarkup(<LanternSkeleton variant="rows" rows={4} />).match(/data-variant|class="[^"]*block/g) ?? []).length).toBe(5);
    expect((renderToStaticMarkup(<LanternSkeleton variant="lines" lines={3} />).match(/class="[^"]*block/g) ?? []).length).toBe(3);
  });
  it("reserved heights match the previous skeleton (CLS)", () => {
    expect(rule(skeletonCss, ".line")).toMatch(/height:\s*14px/);
    expect(rule(skeletonCss, ".row")).toMatch(/height:\s*56px/);
    expect(rule(skeletonCss, ".card")).toMatch(/height:\s*240px/);
  });
  it("map variant reserves its box by height or aspect", () => {
    expect(renderToStaticMarkup(<LanternSkeleton variant="map" height={320} />)).toContain("min-height:320px");
    expect(renderToStaticMarkup(<LanternSkeleton variant="map" aspect={2} />)).toContain("aspect-ratio:2");
  });
  it("animates transform and opacity only", () => {
    for (const css of [skeletonCss, maskCss]) {
      const frames = [...css.matchAll(/@keyframes\s+\w+\s*{([\s\S]*?)\n}/g)].map((m) => m[1] ?? "");
      expect(frames.length).toBeGreaterThan(0);
      for (const f of frames) {
        const props = [...f.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
        expect(props.length).toBeGreaterThan(0);
        for (const p of props) expect(["transform", "opacity"]).toContain(p);
      }
    }
  });
});

describe("UI-19.38 reduced motion neutralises new animations", () => {
  it("skeleton animations are none inside prefers-reduced-motion", () => {
    const block = skeletonCss.match(/@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*$/)?.[0] ?? "";
    for (const c of [".fog", ".fogSlow", ".glyph"]) expect(block).toContain(c);
    expect(block).toMatch(/animation:\s*none/);
  });
  it("mask curtain is hidden inside prefers-reduced-motion", () => {
    const block = maskCss.match(/@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*$/)?.[0] ?? "";
    expect(block).toMatch(/\.mask\s*{[^}]*animation:\s*none/);
    expect(block).toMatch(/display:\s*none/);
  });
});

describe("UI-19.29 MaskReveal", () => {
  it("duration is 600 ms", () => {
    expect(MASK_REVEAL_MS).toBe(600);
    expect(maskCss).toMatch(/animation:\s*maskLift 600ms/);
  });
  it("server render has the content untouched and no overlay", () => {
    const html = renderToStaticMarkup(
      <MaskReveal>
        <h1>Methods</h1>
      </MaskReveal>,
    );
    expect(html).toBe("<h1>Methods</h1>");
  });
  it("overlay is inert, decorative and transform/opacity only", () => {
    expect(rule(maskCss, ".mask")).toMatch(/pointer-events:\s*none/);
    const src = read("src/components/methods/MaskReveal.tsx");
    expect(src).toContain('aria-hidden="true"');
    expect(src).toContain("matchMedia");
    expect(rule(maskCss, ".mask")).not.toMatch(/\b(width|height|top|left)\s*:/);
  });
});
