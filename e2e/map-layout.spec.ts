import { test, expect } from "@playwright/test";
import { pinClock } from "./helpers";

/**
 * UI-20.18 / UI-20.19 (task 19.3, supersedes the 340 px column of 17.7): at 1024 px and up the map panel spans the
 * full content width with the "All places" table below it, and places without data are only drawn when the toggle is on.
 */
const MARKERS = "[data-map] button[data-location-id]";

for (const width of [1024, 1440]) {
  test.describe(`landing layout at ${width} px`, () => {
    test.beforeEach(({}, info) => {
      test.skip(info.project.name !== "desktop", "desktop viewports only");
    });

    test("map panel spans the content width, the table sits below it at full width, no 340 px column", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await pinClock(page);
      await page.goto("/");
      const panel = page.locator("[data-map-panel]");
      await expect(panel).toBeVisible();
      const table = page.locator("table[data-places-table]");
      await expect(table).toBeVisible();
      const p = (await panel.boundingBox())!;
      const t = (await table.boundingBox())!;
      // Same left edge and width (within a pixel): one full-width column.
      expect(Math.abs(p.x - t.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.width - t.width)).toBeLessThanOrEqual(1);
      // The panel takes the content width (the viewport minus the page padding), not a column beside a list.
      expect(p.width).toBeGreaterThan(width * 0.85);
      // The table starts below the panel, not beside it.
      expect(t.y).toBeGreaterThanOrEqual(p.y + p.height - 1);
      // The 16:9 stage is capped at 70vh and centred in the panel (the width is limited, not stretched).
      const stage = (await page.locator("div[role=group][data-map]").boundingBox())!;
      expect(stage.height).toBeLessThanOrEqual(0.7 * 900 + 1);
      expect(Math.abs(stage.width / stage.height - 16 / 9)).toBeLessThan(0.03);
      expect(stage.width).toBeLessThanOrEqual(p.width + 1);
      expect(Math.abs(stage.x - p.x - (p.x + p.width - stage.x - stage.width))).toBeLessThanOrEqual(2);
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
  const TABLE_ROWS = "table[data-places-table] tbody tr";
  const rowsBefore = await page.locator(TABLE_ROWS).count();
  expect(rowsBefore).toBeGreaterThan(0);
  const before = await page.locator(MARKERS).count();
  await expect(async () => {
    await toggle.check();
    await expect(page).toHaveURL(/nodata=1/, { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await page.waitForTimeout(300);
  await expect.poll(() => page.locator(MARKERS).count()).toBeGreaterThan(before);
  expect(await page.locator(TABLE_ROWS).count()).toBe(rowsBefore);
});
