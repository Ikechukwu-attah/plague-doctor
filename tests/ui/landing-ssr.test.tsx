import { Suspense } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Home from "../../src/app/page";
import { LANDING_HEADING, limitation } from "../../src/ui-copy/states";

/** Task 15.7 (UI-16.1, UI-16.2, UI-2.1, UI-12.1, UI-1.12): the hero is server markup with no client dependency. */
const html = renderToStaticMarkup(<Suspense>{Home()}</Suspense>);
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

describe("landing server shell (task 15.7)", () => {
  it("contains the h1 and the limitation line, unchanged, in the first markup", () => {
    expect(html).toContain(`<h1>${escape(LANDING_HEADING)}</h1>`);
    expect(html).toContain(`<p>${escape(limitation())}</p>`);
  });

  it("renders the hero before the loading placeholder, not inside it", () => {
    const hero = html.indexOf("<h1>");
    const placeholder = html.indexOf('aria-busy="true"');
    expect(hero).toBeGreaterThanOrEqual(0);
    expect(placeholder).toBeGreaterThan(hero);
    const intro = html.slice(0, placeholder);
    expect(intro).toContain(escape(limitation()));
  });

  it("page.tsx is a server component: no 'use client', and the h1/p are not children of a client wrapper", () => {
    const src = readFileSync("src/app/page.tsx", "utf8");
    expect(src).not.toMatch(/^\s*["']use client["']/m);
    const header = src.slice(src.indexOf("<header"), src.indexOf("</header>"));
    expect(header).toContain("<h1>");
    expect(header).toContain("<p>");
    expect(header).not.toMatch(/<(LandingIsland|LandingView|Suspense)/);
  });

  it("the data island, map and detail surface are loaded with next/dynamic", () => {
    expect(readFileSync("src/components/landing/LandingIsland.tsx", "utf8")).toMatch(/dynamic\(\s*\(\)\s*=>[^;]*import\("\.\/LandingView"\)/);
    const view = readFileSync("src/components/landing/LandingView.tsx", "utf8");
    expect(view).toMatch(/dynamic\(\(\) => import\("\.\/CanadaMap"\)/);
    expect(view).toMatch(/dynamic\(\(\) => import\("\.\/DetailSurface"\)/);
    expect(view).not.toMatch(/^import .* from "\.\/(CanadaMap|DetailSurface)";/m);
  });
});
