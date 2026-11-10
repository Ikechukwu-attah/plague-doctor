import { test, expect } from "@playwright/test";
import { pinClock } from "./helpers";

/**
 * Task 17.15 (UI-3.6, UI-3.11): at 800 px no visible map label overlaps a marker or cluster button
 * (other than its own marker's) or another label, and no label text is covered.
 */
const ITEMS = "[data-map] button[data-location-id], [data-map] button[data-cluster-id]";

test("labels at 800 px never overlap markers, clusters or each other", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop viewport only");
  await page.setViewportSize({ width: 800, height: 900 });
  await pinClock(page);
  await page.goto("/");
  await expect(page.locator(ITEMS).first()).toBeVisible();
  // Clustering and labels run after the first ResizeObserver measurement.
  await page.waitForTimeout(400);
  const result = await page.evaluate((sel) => {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>(sel));
    const labels = Array.from(document.querySelectorAll<HTMLElement>("[data-map] [data-label]"));
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const problems: string[] = [];
    const rects = labels.map((l) => ({ el: l, r: l.getBoundingClientRect(), own: l.closest("button")! }));
    for (const { el, r, own } of rects) {
      const name = el.textContent ?? "?";
      for (const b of buttons) {
        if (b === own) continue;
        if (hit(r, b.getBoundingClientRect())) problems.push(`${name} overlaps ${b.getAttribute("aria-label")}`);
      }
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cy >= 0 && cy <= window.innerHeight) {
        const top = document.elementFromPoint(cx, cy);
        // Labels have pointer-events: none, so the hit target is whatever lies beneath. It must not be another marker/cluster.
        const owner = top?.closest("button");
        if (owner && owner !== own) problems.push(`${name} covered by ${owner.getAttribute("aria-label")}`);
      }
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        if (hit(rects[i]!.r, rects[j]!.r)) problems.push(`${rects[i]!.el.textContent} overlaps ${rects[j]!.el.textContent}`);
    return { count: labels.length, problems };
  }, ITEMS);
  expect(result.problems).toEqual([]);
  console.log(`labels at 800 px: ${result.count}`);
});
