import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detailModeForWidth } from "@/components/landing/DetailSurface";

describe("UI-5.9 UI-4.8 detail surface mode by width", () => {
  it.each([
    [1440, "drawer"],
    [1024, "drawer"],
    [1023, "sheet"],
    [768, "sheet"],
    [767, "page"],
    [390, "page"],
  ] as const)("%i px -> %s", (width, mode) => {
    expect(detailModeForWidth(width)).toBe(mode);
  });
});

describe("UI-5.10 detail surface is out of document flow", () => {
  const css = readFileSync("src/components/landing/Landing.module.css", "utf8");
  const block = (name: string) => new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";

  it("drawer is fixed, 400 px wide", () => {
    expect(block("drawer")).toMatch(/position:\s*fixed/);
    expect(block("drawer")).toMatch(/width:\s*400px/);
  });
  it("sheet is fixed", () => {
    expect(block("sheet")).toMatch(/position:\s*fixed/);
  });
  it("DetailSurface renders no close control of its own", () => {
    const src = readFileSync("src/components/landing/DetailSurface.tsx", "utf8");
    expect(src).not.toMatch(/<button/);
  });
});
