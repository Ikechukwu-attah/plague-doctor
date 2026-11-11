/**
 * UI-20.1 UI-20.2 UI-20.3 UI-20.4 (Property 31, static part)
 * The hardened .visually-hidden utility and positioned list ancestors, so absolutely positioned
 * screen-reader text can never extend the document below the footer.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const root = process.cwd();
const globals = readFileSync(join(root, "src/app/globals.css"), "utf8");
const landing = readFileSync(join(root, "src/components/landing/Landing.module.css"), "utf8");

/** Body of the top-level rule whose selector is exactly `selector` (line-anchored). */
function rule(css: string, selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`^${esc}\\s*\\{([^}]*)\\}`, "m"));
  if (!m) throw new Error(`rule ${selector} not found`);
  return m[1]!;
}

describe("UI-20.1 hardened .visually-hidden", () => {
  const body = rule(globals, ".visually-hidden");
  const required: [string, RegExp][] = [
    ["position:absolute", /position:\s*absolute/],
    ["width:1px", /width:\s*1px/],
    ["height:1px", /height:\s*1px/],
    ["margin:-1px", /margin:\s*-1px/],
    ["overflow:hidden", /overflow:\s*hidden/],
    ["clip-path:inset(50%)", /clip-path:\s*inset\(50%\)/],
    ["white-space:nowrap", /white-space:\s*nowrap/],
  ];
  for (const [label, re] of required) {
    it(`UI-20.1 declares ${label}`, () => expect(body).toMatch(re));
  }
});

describe("UI-20.2 list scroller and rows are positioned ancestors", () => {
  for (const sel of [".list", ".rows", ".row", ".rowItem"]) {
    it(`UI-20.2 ${sel} has position: relative`, () => {
      expect(rule(landing, sel)).toMatch(/position:\s*relative/);
    });
  }
});
