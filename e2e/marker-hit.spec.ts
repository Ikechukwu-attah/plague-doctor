import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { pinClock } from "./helpers";
/**
 * Property 34 (task 19.2, UI-20.12 to UI-20.15): the element under each marker's centre is that marker.
 * 1440 and 1024: every marker, hard assertion. 390: through the "Show map" toggle, best effort (reported).
 */
const MARKERS = "[data-map] button[data-location-id]";

async function showMap(page: Page): Promise<void> {
  await pinClock(page);
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Show map", exact: true });
  const first = page.locator(MARKERS).first();
  // Below 640 px the map starts hidden; the toggle is server-rendered, so retry until hydration has attached its handler.
  await expect(async () => {
    if (await toggle.isVisible()) await toggle.click();
    await expect(first).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  // The dodge runs after the first ResizeObserver measurement.
  await page.waitForTimeout(400);
}

interface HitReport {
  total: number;
  bad: string[];
  /** Pairs of marker hit boxes (24 px) that overlap in the layout. */
  overlaps: string[];
  tooSmall: string[];
}

async function hitReport(page: Page): Promise<HitReport> {
  return page.evaluate((sel) => {
    const out: HitReport = { total: 0, bad: [], overlaps: [], tooSmall: [] };
    const els = Array.from(document.querySelectorAll<HTMLElement>(sel));
    // `[data-map]` also matches the page body container; the map stage is the role=group element.
    const map = document.querySelector("div[role=group][data-map]") as HTMLElement;
    map.scrollIntoView({ block: "center" });
    for (const el of els) {
      const id = el.getAttribute("data-location-id") ?? "?";
      out.total += 1;
      const r = el.getBoundingClientRect();
      if (r.width < 24 - 0.5 || r.height < 24 - 0.5) out.tooSmall.push(id);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit?.closest("button") !== el) out.bad.push(id);
    }
    const rects = els.map((e) => ({ id: e.getAttribute("data-location-id") ?? "?", r: e.getBoundingClientRect() }));
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!.r;
        const b = rects[j]!.r;
        if (a.left < b.right - 0.01 && a.right > b.left + 0.01 && a.top < b.bottom - 0.01 && a.bottom > b.top + 0.01)
          out.overlaps.push(`${rects[i]!.id}|${rects[j]!.id}`);
      }
    return out;
  }, MARKERS);
}

test.describe("marker hit targets (UI-20.12 to UI-20.15, Property 34)", () => {
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    test(`every marker's centre hits that marker at ${vp.width}x${vp.height}`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "desktop viewports only");
      await page.setViewportSize(vp);
      await showMap(page);
      const rep = await hitReport(page);
      console.log(`markers at ${vp.width}: ${rep.total}, bad=${rep.bad.length}, overlapping pairs=${rep.overlaps.length}`);
      expect(rep.total).toBeGreaterThan(0);
      expect(rep.tooSmall).toEqual([]);
      expect(rep.overlaps).toEqual([]);
      expect(rep.bad).toEqual([]);
    });
  }

  test("390: markers via the Show map toggle; any marker that cannot be separated is still reachable from the list", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "mobile viewport only");
    await showMap(page);
    const rep = await hitReport(page);
    console.log(`markers at 390: ${rep.total}, bad=${rep.bad.length} ${JSON.stringify(rep.bad)}, overlapping pairs=${rep.overlaps.length} ${JSON.stringify(rep.overlaps)}`);
    expect(rep.total).toBeGreaterThan(0);
    expect(rep.tooSmall).toEqual([]);
    // Measured: all markers separate at 390 with the current data. If a future dataset is denser than the dodge cap
    // allows, any marker that fails the hit test must at least have a list row (the other path to every place).
    expect(rep.overlaps.length).toBeLessThanOrEqual(rep.bad.length);
    for (const id of rep.bad) {
      await expect(page.locator(`a[data-location-id="${id}"]`).first()).toBeAttached();
    }
  });
});

test("leader lines: each displaced marker has one aria-hidden leader and an anchor dot", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop viewport only");
  await showMap(page);
  const r = await page.evaluate(() => {
    const svg = document.querySelector<SVGElement>("[data-map] [data-leaders]");
    return {
      present: !!svg,
      hidden: svg?.getAttribute("aria-hidden") === "true",
      lines: svg?.querySelectorAll("line").length ?? 0,
      dots: svg?.querySelectorAll("circle").length ?? 0,
      stroke: svg ? getComputedStyle(svg.querySelector("line")!).strokeWidth : "",
    };
  });
  expect(r.present).toBe(true);
  expect(r.hidden).toBe(true);
  expect(r.lines).toBeGreaterThan(0);
  expect(r.dots).toBe(r.lines);
  expect(r.stroke).toBe("1px");
});
