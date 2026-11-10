import { expect, test } from "@playwright/test";
import { fetchLocations, pickCity, pinClock } from "./helpers";
import { whenOutOfRange } from "../src/ui-copy/planner";

// UI-19.12 to 19.14: the date input is bounded to today..today+365 and typed values are validated.
test.describe("planner date range", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    await pinClock(page);
  });

  test("a six-digit year shows the message and Next stays disabled", async ({ page, request }) => {
    const city = pickCity(await fetchLocations(request));
    await page.goto("/plan");
    await page.getByLabel("Search places").fill(city.locationName);
    await page.getByRole("list", { name: "Places" }).getByRole("button").filter({ hasText: city.locationName }).first().click();
    const next = page.getByRole("button", { name: "Next", exact: true });
    await next.click();

    const date = page.getByLabel("Date of your gathering");
    await expect(date).toHaveAttribute("min", "2026-11-02");
    await expect(date).toHaveAttribute("max", "2027-11-02");

    const message = whenOutOfRange({ min: "2026-11-02", max: "2027-11-02" });
    await date.fill("2026-11-10");
    await expect(next).toBeEnabled();

    // Typing a six-digit year into the year segment bypasses min/max.
    // Chromium accepts a six-digit year typed into the year segment; reproduce the
    // resulting value through the native setter (Playwright's fill rejects it).
    await date.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(el, "275760-01-01");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(date).toHaveValue("275760-01-01");
    await expect(page.getByText(message)).toBeVisible();
    await expect(next).toBeDisabled();

    await date.fill("2026-11-10");
    await expect(page.getByText(message)).toHaveCount(0);
    await expect(next).toBeEnabled();

    await date.fill("2026-10-01");
    await expect(page.getByText(message)).toBeVisible();
    await expect(next).toBeDisabled();
  });
});
