import { expect, test } from "@playwright/test";
import { NEAR_DATE, completePlanner, fetchLocations, pickCity, pinClock } from "./helpers";
import { LANDING_HEADING } from "../src/ui-copy/states";

test.describe("smoke: landing → city → plan → card (UI-17.6, UI-9.1, UI-9.8)", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await pinClock(page);
  });

  test("a visitor can go from the map to a copied Omen Card share text", async ({ page, request }) => {
    const city = pickCity(await fetchLocations(request));

    // Landing: heading and a row for the city, derived from the live API.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: LANDING_HEADING })).toBeVisible();
    const row = page.locator(`a[data-location-id="${city.locationId}"]`);
    await expect(row).toBeVisible();

    // City detail: a drawer/sheet on wide screens, the city page on narrow ones.
    await row.click();
    const wide = (page.viewportSize()?.width ?? 0) >= 768;
    if (wide) {
      await expect(page.locator("aside[data-variant]")).toBeVisible();
      await expect(page.locator("aside[data-variant]").getByRole("heading", { level: 2, name: city.locationName })).toBeVisible();
    } else {
      await expect(page).toHaveURL(new RegExp(`/city/${city.locationId}`));
      await expect(page.getByRole("heading", { level: 1, name: city.locationName })).toBeVisible();
    }


    // Planner → Card.
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Plan a gathering" }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await completePlanner(page, { placeName: city.locationName, date: NEAR_DATE });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(city.locationName);

    // The copied clipboard text is exactly the share text on screen.
    const shown = await page.locator("pre").first().textContent();
    expect(shown).toBeTruthy();
    await page.getByRole("button", { name: "Copy share text" }).click();
    await expect(page.getByText("Share text copied").first()).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(shown);
  });
});
