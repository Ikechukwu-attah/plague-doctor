/** UI-19.22 UI-19.23 UI-19.24: living fog bound to the PHAC level. Property 29: reduced motion means no animation. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { checkWording } from "../../src/evidence/wording-guard";
import { LEGEND_SENTENCE } from "../../src/ui-copy/landing";
import { Legend } from "../../src/components/landing/Legend";
import { fogScale, fogSpec } from "../../src/lib/view/fog";
import { activityArb } from "./helpers";

const css = readFileSync(join(process.cwd(), "src/components/landing/Landing.module.css"), "utf8");

interface Rule {
  selector: string;
  body: string;
}

/** Split CSS into the reduced-motion block and everything else (blocks here are one level deep). */
function split(src: string): { base: string; reduced: string } {
  const start = src.indexOf("@media (prefers-reduced-motion: reduce)");
  expect(start).toBeGreaterThanOrEqual(0);
  const open = src.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  return { base: src.slice(0, start) + src.slice(end + 1), reduced: src.slice(open + 1, end) };
}

function rules(src: string): Rule[] {
  const out: Rule[] = [];
  const re = /([^{}@]+)\{([^{}]*)\}/g;
  for (const m of src.matchAll(re)) out.push({ selector: m[1]!.trim(), body: m[2]! });
  return out;
}

const { base, reduced } = split(css);
const FOG_SELECTORS = [".fogSpot", ".fogDrift", ".fogHatch"];
const sets = (body: string, prop: "animation" | "transition") =>
  new RegExp(`(^|[;\\s])${prop}\\s*:(?!\\s*none\\b)\\s*[^;\\s]`, "m").test(body);

describe("UI-19.22 legend sentence", () => {
  it("is exactly the approved text, in the Legend markup, and wording-guard clean", () => {
    expect(LEGEND_SENTENCE).toBe("Fog shows PHAC's activity level. It is not your risk.");
    expect(checkWording(LEGEND_SENTENCE).violations).toEqual([]);
    const html = renderToStaticMarkup(createElement(Legend));
    expect(html).toContain("Fog shows PHAC&#x27;s activity level. It is not your risk.");
  });
});

describe("UI-19.23 compositor-only fog motion", () => {
  it("drift @keyframes only contain transform / opacity", () => {
    const kf = css.match(/@keyframes drift\s*{([\s\S]*?\n})\s*(?=[.@]|$)/)?.[1] ?? "";
    expect(kf).toContain("transform");
    const props = [...kf.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    for (const p of props) expect(["transform", "opacity"]).toContain(p);
  });
  it("fog rules never transition width, height or background", () => {
    for (const r of rules(base).filter((x) => FOG_SELECTORS.includes(x.selector))) {
      const t = r.body.match(/transition\s*:([^;]*)/)?.[1] ?? "";
      expect(t, r.selector).not.toMatch(/\b(width|height|background|all)\b/);
    }
    expect(base).not.toMatch(/\.fogDrift\s*{[^}]*transition[^}]*(width|height)/);
  });
  it("scale and opacity are monotone in the PHAC level; unknown is hatched, smallest and never fog", () => {
    const order = ["not_detected", "low", "moderate", "high"] as const;
    const specs = order.map((a) => fogSpec(a));
    for (let i = 1; i < specs.length; i++) {
      const a = specs[i - 1]!;
      const b = specs[i]!;
      if (a.kind !== "fog" || b.kind !== "fog") throw new Error("expected fog");
      expect(fogScale(b)).toBeGreaterThan(fogScale(a));
      expect(b.peakOpacity).toBeGreaterThan(a.peakOpacity);
    }
    expect(fogSpec("unknown").kind).toBe("hatch");
    expect(fogScale(fogSpec("unknown"))).toBeLessThan(fogScale(specs[0]!));
  });
});

describe("Property 29: reduced motion means no animation (UI-19.24)", () => {
  const animated = rules(base).filter((r) => sets(r.body, "animation") || sets(r.body, "transition"));
  it("includes the fog selectors among the animated selectors", () => {
    const names = animated.map((r) => r.selector);
    for (const s of [".fogSpot", ".fogDrift"]) expect(names).toContain(s);
  });
  it("every animated rule is neutralised in the reduced-motion block", () => {
    const neutral = rules(reduced);
    fc.assert(
      fc.property(fc.constantFrom(...animated), (rule) => {
        const matches = neutral.filter((n) => n.selector.split(",").map((s) => s.trim()).includes(rule.selector));
        expect(matches.length, rule.selector).toBeGreaterThan(0);
        const body = matches.map((m) => m.body).join(";");
        if (sets(rule.body, "animation")) expect(body, rule.selector).toMatch(/animation\s*:\s*none/);
        if (sets(rule.body, "transition")) expect(body, rule.selector).toMatch(/transition\s*:\s*none/);
      }),
    );
  });
  it("fog level is irrelevant to the neutralisation (any activity yields the same static CSS)", () => {
    fc.assert(fc.property(activityArb, (a) => fogScale(fogSpec(a)) > 0));
  });
});
