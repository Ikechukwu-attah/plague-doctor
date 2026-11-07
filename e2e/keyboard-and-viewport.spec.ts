import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";
import { NEAR_DATE, cardUrl, fetchLocations, pickCity, pinClock } from "./helpers";
import { SKIP_TO_CONTENT } from "../src/ui-copy/states";
import { CITY_CLOSE } from "../src/ui-copy/city";

// Viewports are set inside each test, so one project is enough.
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "viewport is set explicitly in these specs");
  await pinClock(page);
});

const MIN_TARGET = 44;

async function expectTargetSize(locator: Locator, what: string): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, what).not.toBeNull();
  expect(box?.height ?? 0, `${what} height`).toBeGreaterThanOrEqual(MIN_TARGET - 0.5);
  expect(box?.width ?? 0, `${what} width`).toBeGreaterThanOrEqual(MIN_TARGET - 0.5);
}

test.describe("keyboard (UI-13.2, UI-13.4, UI-4.7, UI-7.5)", () => {
  test("the skip link is the first tab stop and moves focus to the content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: SKIP_TO_CONTENT });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#content")).toBeFocused();
  });

  test("arrow keys move the virus selection and exactly one chip stays pressed", async ({ page }) => {
    await page.goto("/");
    const chips = page.getByRole("group", { name: "Virus" }).getByRole("button");
    await expect(chips).toHaveCount(4);
    await chips.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await expect(chips.nth(1)).toBeFocused();
    await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "Virus" }).locator('button[aria-pressed="true"]')).toHaveCount(1);
    await page.keyboard.press("End");
    await expect(chips.nth(3)).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Home");
    await expect(chips.nth(0)).toHaveAttribute("aria-pressed", "true");
  });

  test("Escape closes the city drawer and focus returns to the row that opened it", async ({ page, request }) => {
    const city = pickCity(await fetchLocations(request));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const row = page.locator(`a[data-location-id="${city.locationId}"]`);
    await expect(row).toBeVisible();
    await row.focus();
    await page.keyboard.press("Enter");
    const drawer = page.locator('aside[data-variant="drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("button", { name: CITY_CLOSE, exact: true })).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(row).toBeFocused();
  });

  test("the provenance dialog closes with Escape and returns focus to its trigger", async ({ page, request }) => {
    const city = pickCity(await fetchLocations(request));
    await page.goto(`/city/${encodeURIComponent(city.locationId)}`);
    const trigger = page.locator("li[data-pathogen]").first().locator('button[aria-haspopup="dialog"]').first();
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the planner can be completed with the keyboard alone", async ({ page, request }) => {
    const city = pickCity(await fetchLocations(request));
    await page.goto("/plan");
    await page.getByLabel("Search places").fill(city.locationName);
    const option = page.getByRole("list", { name: "Places" }).getByRole("button").filter({ hasText: city.locationName }).first();
    await option.focus();
    await page.keyboard.press("Space");
    await expect(option).toHaveAttribute("aria-pressed", "true");
    const next = page.getByRole("button", { name: "Next", exact: true });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "When is it?" })).toBeFocused();
  });
});

test.describe("targets and viewports (UI-13.3, UI-4.8, UI-5.9, UI-8.12)", () => {
  test("interactive targets are at least 44 px on the landing page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const rows = page.locator("a[data-location-id]");
    await expect(rows.first()).toBeVisible();
    const chips = page.getByRole("group", { name: "Virus" }).getByRole("button");
    for (let i = 0; i < (await chips.count()); i += 1) await expectTargetSize(chips.nth(i), `virus chip ${i}`);
    const shown = Math.min(await rows.count(), 5);
    for (let i = 0; i < shown; i += 1) {
      const box = await rows.nth(i).boundingBox();
      expect(box?.height ?? 0, `city row ${i}`).toBeGreaterThanOrEqual(MIN_TARGET - 0.5);
    }
  });

  test("interactive targets are at least 44 px in the planner", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/plan");
    const options = page.getByRole("list", { name: "Places" }).getByRole("button");
    await expect(options.first()).toBeVisible();
    await expectTargetSize(options.first(), "place option");
    await expectTargetSize(page.getByRole("button", { name: "Next", exact: true }), "Next button");
    await expectTargetSize(page.getByLabel("Search places"), "search input");
  });

  test("no horizontal scrolling at 390 px on any route", async ({ page, request }) => {
    const city = pickCity(await fetchLocations(request));
    await page.setViewportSize({ width: 390, height: 844 });
    const routes = [
      "/",
      `/city/${encodeURIComponent(city.locationId)}`,
      "/plan",
      cardUrl(city.locationId, NEAR_DATE),
      "/methods",
    ];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(overflow.scroll, `horizontal overflow on ${route}`).toBeLessThanOrEqual(overflow.client);
    }
  });

  test("city details open as a drawer, a bottom sheet or a page depending on width", async ({ page, request }) => {
    const city = pickCity(await fetchLocations(request));
    const open = async (width: number) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const row = page.locator(`a[data-location-id="${city.locationId}"]`);
      await expect(row).toBeVisible();
      await row.click();
    };

    const surface = page.locator("aside[data-variant]");
    const expectFixedSingleClose = async () => {
      await expect(surface).toBeVisible();
      expect(await surface.evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
      await expect(surface.getByRole("button", { name: /close/i })).toHaveCount(1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      expect(overflow).toBe(true);
    };

    await open(1440);
    await expect(surface).toHaveAttribute("data-variant", "drawer");
    await expectFixedSingleClose();
    const box = await surface.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(400);
    expect(Math.round((box?.x ?? 0) + (box?.width ?? 0))).toBe(1440);

    await open(900);
    await expect(surface).toHaveAttribute("data-variant", "sheet");
    await expectFixedSingleClose();

    await open(390);
    await expect(page).toHaveURL(new RegExp(`/city/${city.locationId}`));
    await expect(page.locator("aside[data-variant]")).toHaveCount(0);
  });
});

test("landing map fits the viewport, list scrolls internally, drawer leaves the nav reachable (task 15.4)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const map = page.locator("div[role=group][data-map]");
  await expect(map).toBeVisible();
  const box = await map.boundingBox();
  expect(box?.height ?? 9999).toBeLessThanOrEqual(900);
  const dims = await page.locator("ul[class*=rows]").evaluate((el) => ({ c: el.clientHeight, s: el.scrollHeight }));
  expect(dims.s).toBeGreaterThan(dims.c);
  await page.locator("button[data-location-id]").first().click({ force: true });
  await expect(page.locator("aside[data-variant=drawer]")).toBeVisible();
  const nav = await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Plan a gathering" }).boundingBox();
  const drawer = await page.locator("aside[data-variant=drawer]").boundingBox();
  expect((nav?.y ?? 0) + (nav?.height ?? 0)).toBeLessThanOrEqual(drawer?.y ?? 0);
});
