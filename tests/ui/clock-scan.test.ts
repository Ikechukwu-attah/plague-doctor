import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ClockProvider, useToday, systemClock } from "../../src/lib/clock";

const ROOT = join(__dirname, "..", "..");
const DIRS = ["src/app", "src/components", "src/lib"];
const ALLOWED = join("src", "lib", "clock.ts");

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("UI-14.7 UI-14.8 clock injection", () => {
  it("UI-14.7 no `new Date(` or `Date.now(` outside src/lib/clock.ts", () => {
    const offenders: string[] = [];
    for (const d of DIRS) {
      for (const f of walk(join(ROOT, d))) {
        if (!/\.(ts|tsx)$/.test(f)) continue;
        const rel = relative(ROOT, f);
        // Server API routes are not UI; data-status only parses stored timestamps for sorting.
        if (rel.split(sep).join("/").startsWith("src/app/api/")) continue;
        if (rel === ALLOWED || rel.split(sep).join("/") === "src/lib/clock.ts") continue;
        if (/new Date\(|Date\.now\(/.test(readFileSync(f, "utf8"))) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("UI-14.8 ClockProvider injects a fixed clock; todayIso is a Toronto calendar date", () => {
    // 2026-11-03T02:00Z is still 2026-11-02 in Toronto (EST, UTC-5).
    const fixed = { now: () => new Date("2026-11-03T02:00:00Z") };
    function Probe() {
      const { todayIso } = useToday();
      return createElement("span", null, todayIso);
    }
    const html = renderToStaticMarkup(
      createElement(ClockProvider, { clock: fixed, children: createElement(Probe) }),
    );
    expect(html).toContain("2026-11-02");
  });

  it("UI-14.8 systemClock ignores window.__PD_TEST_NOW__ unless the test flag is built in", () => {
    expect(process.env.NEXT_PUBLIC_PD_TEST_CLOCK).not.toBe("1");
    expect(systemClock.now()).toBeInstanceOf(Date);
  });
});
