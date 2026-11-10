import { test, expect } from "@playwright/test";
import { pinClock } from "./helpers";

/**
 * UI-19.18 / UI-19.19 (task 17.7): at 1024 px and up the map panel fills the column beside a ~340 px
 * city list, and places without data are only drawn when the toggle is on.
 */
const MARKERS = "[data-map] button[data-location-id], [data-map] button[data-cluster-id]";

for (const width of [1024, 1440]) {
  test.describe(`landing layout at ${width} px`, () => {
    test.beforeEach(({}, info) => {
      test.skip(info.project.name !== "desktop", "desktop viewports only");
    });

    test("map panel takes the content width, the list column is about 340 px", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await pinClock(page);
      await page.goto("/");
      const panel = page.locator("[data-map-panel]");
      await expect(panel).toBeVisible();
      const list = page.locator("ul[class*=rows]");
      await expect(list).toBeVisible();
      const p = (await panel.boundingBox())!;
      const l = (await list.boundingBox())!;
      expect(Math.abs(l.width - 340)).toBeLessThanOrEqual(8);
      const content = p.width + l.width;
      if (width === 1440) expect(p.width / content).toBeGreaterThan(0.6);
      expect(p.width).toBeGreaterThan(l.width);
      // The stage stays within the viewport height budget.
      const stage = (await page.locator("div[role=group][data-map]").boundingBox())!;
      expect(stage.height).toBeLessThanOrEqual(900);
      expect(stage.width).toBeLessThanOrEqual(p.width + 1);
    });
  });
}

test("'Show places without data' reveals more markers and is kept in the URL", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop viewport only");
  await pinClock(page);
  await page.goto("/");
  const toggle = page.getByRole("checkbox", { name: "Show places without data" });
  await expect(toggle).not.toBeChecked();
  await expect(page.locator(MARKERS).first()).toBeVisible();
  await page.waitForTimeout(300);
  const rowsBefore = await page.locator("ul[class*=rows] li").count();
  const before = await page.locator(MARKERS).count();
  await expect(async () => {
    await toggle.check();
    await expect(page).toHaveURL(/nodata=1/, { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await page.waitForTimeout(300);
  await expect.poll(() => page.locator(MARKERS).count()).toBeGreaterThan(before);
  expect(await page.locator("ul[class*=rows] li").count()).toBe(rowsBefore);
});
