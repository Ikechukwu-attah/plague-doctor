import { expect, test } from "@playwright/test";
import { LANDING_HEADING, limitation } from "../src/ui-copy/states";

/** Task 15.7 (UI-16.1, UI-1.12): the hero and the limitation line are in the HTML, not produced by JavaScript. */
test.describe("landing hero without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("h1 and the limitation line are visible before any hydration", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: LANDING_HEADING })).toBeVisible();
    await expect(page.getByText(limitation(), { exact: true })).toBeVisible();
  });
});
