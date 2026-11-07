import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { NEAR_DATE, cardUrl, fetchLocations, pickCity, pinClock } from "./helpers";

/** WCAG 2.x A/AA rules; serious and critical findings fail the test (UI-13.1, UI-17.7). */
async function expectNoSeriousViolations(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  // Map markers are packed by geography and can sit closer than WCAG 2.5.8's 24 px spacing;
  // every marker has an equivalent full-size list row (2.5.8 "Equivalent" exception), which
  // axe cannot see. So target-size is checked on everything except the map markers.
  const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
  const main = await new AxeBuilder({ page }).withTags(tags).disableRules(["target-size"]).analyze();
  const sizes = await new AxeBuilder({ page }).withRules(["target-size"]).exclude("button[data-location-id]").analyze();
  const results = { violations: [...main.violations, ...sizes.violations] };
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5) })),
  ).toEqual([]);
}

test.describe("axe: no serious or critical violations (UI-13.1, UI-17.7)", () => {
  let cityId = "";
  let cityName = "";

  test.beforeEach(async ({ page, request }) => {
    await pinClock(page);
    const city = pickCity(await fetchLocations(request));
    cityId = city.locationId;
    cityName = city.locationName;
  });

  test("landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("a[data-location-id]").first()).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("landing page with the list view", async ({ page }) => {
    await page.goto("/?view=list");
    await expect(page.locator("a[data-location-id]").first()).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("city page", async ({ page }) => {
    await page.goto(`/city/${encodeURIComponent(cityId)}`);
    await expect(page.getByRole("heading", { level: 1, name: cityName })).toBeVisible();
    await expect(page.locator("li[data-pathogen]").first()).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("planner", async ({ page }) => {
    await page.goto("/plan");
    await expect(page.getByRole("list", { name: "Places" })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("Omen Card (near date)", async ({ page }) => {
    await page.goto(cardUrl(cityId, NEAR_DATE));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(cityName);
    await expectNoSeriousViolations(page);
  });

  test("provenance triggers on card and city (UI-7.1, UI-13.5)", async ({ page }) => {
    for (const url of [cardUrl(cityId, NEAR_DATE), `/city/${encodeURIComponent(cityId)}`]) {
      await page.goto(url);
      const trigger = page.locator('button[aria-haspopup="dialog"]').first();
      await expect(trigger).toBeVisible();
      await expect(trigger.locator("[data-prov-glyph]")).toHaveText("i");
      const box = await trigger.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await page.waitForLoadState("networkidle");
      const res = await new AxeBuilder({ page })
        .include('button[aria-haspopup="dialog"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      const blocking = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking.map((v) => v.id)).toEqual([]);
    }
  });

  test("Behind the mask", async ({ page }) => {
    await page.goto("/methods");
    await expect(page.getByRole("heading", { level: 1, name: "Behind the mask" })).toBeVisible();
    await expectNoSeriousViolations(page);
  });
});
