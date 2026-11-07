import { expect, test } from "@playwright/test";
import { FAR_DATE, NEAR_DATE, PAST_DATE, cardUrl, fetchLocations, pickCity, pickNoCitySite, pinClock } from "./helpers";
import { checkWording } from "../src/evidence/wording-guard";

test.describe("rendered route text passes the wording guard (UI-14.5, UI-17.8)", () => {
  test.beforeEach(async ({ page }) => {
    await pinClock(page);
  });

  async function mainText(route: string, page: import("@playwright/test").Page, ready: () => Promise<void>): Promise<string> {
    await page.goto(route);
    await ready();
    await page.waitForLoadState("networkidle");
    return page.locator("main#content").innerText();
  }

  function expectClean(route: string, text: string): void {
    expect(text.length, `${route} rendered text`).toBeGreaterThan(0);
    expect(checkWording(text).violations, `wording violations on ${route}`).toEqual([]);
    expect(text.toLowerCase(), `"sampled on" on ${route}`).not.toContain("sampled on");
  }

  test("main routes", async ({ page, request }) => {
    const city = pickCity(await fetchLocations(request));
    const routes: Array<[string, () => Promise<void>]> = [
      ["/", async () => void (await expect(page.locator("a[data-location-id]").first()).toBeVisible())],
      [
        `/city/${encodeURIComponent(city.locationId)}`,
        async () => void (await expect(page.locator("li[data-pathogen]").first()).toBeVisible()),
      ],
      ["/plan", async () => void (await expect(page.getByRole("list", { name: "Places" })).toBeVisible())],
      ["/methods", async () => void (await expect(page.getByRole("heading", { level: 1 })).toBeVisible())],
    ];
    for (const [route, ready] of routes) expectClean(route, await mainText(route, page, ready));
  });

  test("Omen Card in each timing state", async ({ page, request }) => {
    const city = pickCity(await fetchLocations(request));
    for (const date of [NEAR_DATE, FAR_DATE, PAST_DATE]) {
      const route = cardUrl(city.locationId, date);
      const text = await mainText(route, page, async () => {
        await expect(page.getByRole("article", { name: "Omen Card" })).toBeVisible();
      });
      expectClean(route, text);
    }
  });

  test("Omen Card for a place without a city site", async ({ page, request }) => {
    const place = pickNoCitySite(await fetchLocations(request));
    test.skip(!place, "The current snapshot has no place with a provincial aggregate and no city site");
    if (!place) return;
    const route = cardUrl(place.locationId, NEAR_DATE);
    const text = await mainText(route, page, async () => {
      await expect(page.getByRole("article", { name: "Omen Card" })).toBeVisible();
    });
    expectClean(route, text);
  });
});
