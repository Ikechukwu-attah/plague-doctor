import { test, expect } from "@playwright/test";
import { pinClock } from "./helpers";

/** UI-19.15 to UI-19.17 (doc 16.6): sort control stored in the URL. */
test.describe("city list sort", () => {
  test("highest activity first updates the URL, survives reload, and is 44 px", async ({ page }) => {
    await pinClock(page);
    await page.goto("/");
    const sort = page.getByLabel("Sort list");
    await expect(sort).toBeVisible();
    const box = await sort.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(sort).toHaveValue("az");

    await expect(async () => {
      await sort.selectOption("activity");
      await expect(page).toHaveURL(/sort=activity/, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    // Any "No data" row must come after every row that has a level.
    const texts = await page.locator("section[aria-label='Cities'] ul > li").allInnerTexts();
    const firstNoData = texts.findIndex((t) => /No data|No monitoring site/.test(t));
    if (firstNoData >= 0) {
      for (const t of texts.slice(firstNoData)) expect(t).toMatch(/No data|No monitoring site/);
    }

    await page.reload();
    await expect(page.getByLabel("Sort list")).toHaveValue("activity");

    await page.getByLabel("Sort list").selectOption("az");
    await expect(page).not.toHaveURL(/sort=/);
  });
});
