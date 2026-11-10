import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { NEAR_DATE, cardUrl, fetchLocations, pickCity, pinClock } from "./helpers";
import { DOWNLOAD_CARD_IMAGE } from "../src/ui-copy/social";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

test.describe("social preview (UI-19.30)", () => {
  for (const route of ["/", "/plan", "/card", "/methods", "/city/toronto"]) {
    test(`${route} has og:image and twitter tags`, async ({ request }) => {
      const res = await request.get(route);
      const html = await res.text();
      expect(html).toMatch(/<meta property="og:image" content="https?:\/\/[^"]+opengraph-image/);
      expect(html).toMatch(/<meta property="og:title"/);
      expect(html).toMatch(/<meta name="twitter:card" content="summary_large_image"/);
      expect(html).toMatch(/<meta name="twitter:image" content="https?:\/\/[^"]+twitter-image/);
    });
  }

  test("/opengraph-image and /twitter-image are PNGs", async ({ request }) => {
    for (const path of ["/opengraph-image", "/twitter-image"]) {
      const res = await request.get(path);
      expect(res.ok()).toBe(true);
      expect(res.headers()["content-type"]).toContain("image/png");
      const bytes = [...(await res.body()).subarray(0, 8)];
      expect(bytes).toEqual(PNG_MAGIC);
    }
  });
});

test.describe("download card as image (UI-19.31)", () => {
  test("clicking Download yields a .png file with PNG bytes", async ({ page, request }) => {
    await pinClock(page);
    const city = pickCity(await fetchLocations(request));
    await page.goto(cardUrl(city.locationId, NEAR_DATE));
    const button = page.getByRole("button", { name: DOWNLOAD_CARD_IMAGE });
    await expect(button).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
    const name = download.suggestedFilename();
    expect(name).toBe(`plague-doctor-card-${city.locationId}-${NEAR_DATE}.png`.toLowerCase().replace(/[^a-z0-9.-]/g, "-"));
    expect(name).toMatch(/\.png$/);
    const path = await download.path();
    const bytes = [...(await readFile(path)).subarray(0, 8)];
    expect(bytes).toEqual(PNG_MAGIC);
  });
});
