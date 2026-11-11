/**
 * Property 31 (UI-20.1 to UI-20.4): the document never extends below the footer, and there is no
 * horizontal overflow. Desktop project only; the viewport is set inside the test.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { NEAR_DATE, cardUrl, fetchLocations, pickCity, pinClock } from "./helpers";

const SIZES = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

async function assertNoExtraHeight(page: Page, label: string): Promise<void> {
  await page.waitForLoadState("networkidle");
  await expect(page.locator("footer").last()).toBeVisible();
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    // The site footer is the last <footer>; the landing also has an in-page freshness footer.
    const footers = document.querySelectorAll("footer");
    const f = footers[footers.length - 1];
    const footerBottom = f ? f.getBoundingClientRect().bottom + window.scrollY : -1;
    return {
      doc: document.documentElement.scrollHeight,
      footerBottom,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    };
  });
  expect(m.footerBottom, `${label} footer present`).toBeGreaterThan(0);
  expect(Math.abs(m.doc - m.footerBottom), `${label} doc ${m.doc} vs footer ${m.footerBottom}`).toBeLessThanOrEqual(2);
  expect(m.scrollW, `${label} horizontal overflow`).toBeLessThanOrEqual(m.clientW);
}

const OVERFLOW_WIDTHS = [1440, 1280, 1024, 768, 390] as const;

test.describe("M5 page-level horizontal overflow on '/'", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "viewport is set inside the test");
  });

  for (const width of OVERFLOW_WIDTHS) {
    test(`no page-level horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await pinClock(page);
      await page.goto("/");
      await expect(page.locator("main a[href^='/city/']").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        bodyScrollW: document.body.scrollWidth,
      }));
      expect(m.scrollW, `scrollWidth ${m.scrollW} vs clientWidth ${m.clientW} at ${width}`).toBeLessThanOrEqual(m.clientW);
      expect(m.bodyScrollW, `body scrollWidth ${m.bodyScrollW} at ${width}`).toBeLessThanOrEqual(m.clientW);
    });
  }
});

test.describe("M5 table level cell keeps its contents inside the cell", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "viewport is set inside the test");
  });

  for (const width of [1440, 1280, 1024] as const) {
    test(`regional-site badge, chip and info button stay inside the Level cell at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await pinClock(page);
      await page.goto("/");
      await expect(page.locator("table button[data-regional-info]").first()).toBeVisible();
      const m = await page.evaluate(() => {
        const out: { name: string; overBy: number }[] = [];
        document.querySelectorAll("table tbody td:nth-child(3)").forEach((td) => {
          const cell = td.getBoundingClientRect();
          td.querySelectorAll("button, span:not(.visually-hidden)").forEach((el) => {
            if (el.closest(".visually-hidden")) return;
            const r = el.getBoundingClientRect();
            if (r.width === 0) return;
            const over = r.right - cell.right;
            if (over > 0.5) out.push({ name: td.parentElement?.textContent?.slice(0, 20) ?? "", overBy: Math.round(over) });
          });
        });
        return out;
      });
      expect(m, `elements extending past the Level cell at ${width}`).toEqual([]);
    });
  }
});

test.describe("Property 31 UI-20.1 UI-20.2 UI-20.3 UI-20.4: no empty page below the footer", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "viewport is set inside the test");
  });

  for (const size of SIZES) {
    test(`routes end at the footer at ${size.width}x${size.height}`, async ({ page, request }) => {
      test.setTimeout(90_000);
      const city = pickCity(await fetchLocations(request));
      await page.setViewportSize(size);
      await pinClock(page);
      const routes = [
        "/",
        "/plan",
        "/methods",
        cardUrl(city.locationId, NEAR_DATE),
        `/city/${city.locationId}`,
      ];
      for (const route of routes) {
        await page.goto(route);
        if (route === "/") await expect(page.locator("main a[href^='/city/']").first()).toBeVisible();
        if (route.startsWith("/city/")) await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await assertNoExtraHeight(page, `${route} @${size.width}`);
      }
    });
  }
});
