import { test, expect } from "@playwright/test";
import { pinClock } from "./helpers";

/**
 * UI-20.24 to UI-20.28 (task 19.3): one-line rows, ellipsized names, row click opens the drawer,
 * the tablet table has no horizontal overflow, and the phone row layout does not overlap.
 */
const TABLE = "table[data-places-table]";

test.describe("places table (desktop and tablet)", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "viewport is set inside the test");
  });

  test("rows are one line at 1440 and 768, names carry title and full text, no horizontal overflow", async ({ page }) => {
    for (const width of [1440, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await pinClock(page);
      await page.goto("/");
      const table = page.locator(TABLE);
      await expect(table).toBeVisible();
      const m = await page.evaluate(() => {
        const rows = [...document.querySelectorAll<HTMLElement>("table[data-places-table] tbody tr")];
        return {
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
          // Regional-site rows may wrap their level cell on a tablet; every other row is one line.
          tall: rows
            .filter((r) => !r.querySelector("[data-regional-label]"))
            .filter((r) => r.getBoundingClientRect().height > 60)
            .map((r) => r.dataset.placeRow),
          count: rows.length,
          names: rows.slice(0, 40).map((r) => {
            const a = r.querySelector<HTMLAnchorElement>("a[data-location-id]")!;
            return { text: a.textContent, title: a.title, cut: a.scrollWidth > a.clientWidth };
          }),
        };
      });
      expect(m.count, `rows @${width}`).toBeGreaterThan(10);
      expect(m.scrollW, `horizontal overflow @${width}`).toBeLessThanOrEqual(m.clientW);
      expect(m.tall, `multi-line rows @${width}`).toEqual([]);
      for (const n of m.names) {
        expect(n.title).toBe(n.text);
        // A name that is cut still has its full text in the DOM, so the accessible name is the full name.
        if (n.cut) expect(n.text!.length).toBeGreaterThan(5);
      }
    }
  });

  test("clicking a row or pressing Enter on the name link opens the same drawer as the marker", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await pinClock(page);
    await page.goto("/");
    const table = page.locator(TABLE);
    await expect(table).toBeVisible();
    const row = table.locator("tbody tr").first();
    const id = (await row.getAttribute("data-place-row"))!;

    // A click on a non-link cell (the province) opens the drawer.
    await expect(async () => {
      await row.locator("td").nth(1).click();
      await expect(page.locator("aside[data-variant=drawer]")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page).toHaveURL(new RegExp(`city=${id}`));
    await expect(row).toHaveClass(/trSelected/);

    // Enter on the name link of another row opens that city in the same drawer.
    const other = table.locator("tbody tr").nth(2);
    const otherId = (await other.getAttribute("data-place-row"))!;
    await other.locator("a[data-location-id]").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`city=${otherId}`));
    await expect(page.locator("aside[data-variant=drawer]")).toBeVisible();
    // One surface, the same `open` path the marker uses (LandingView.open).
    await expect(page.locator("aside[data-variant=drawer]")).toHaveCount(1);
  });

  test("each row has one open control; no duplicate landmarks for a place", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator(TABLE)).toBeVisible();
    const dupes = await page.evaluate(() => {
      const ids = [...document.querySelectorAll("a[data-location-id]")].map((a) => a.getAttribute("data-location-id"));
      return ids.length - new Set(ids).size;
    });
    expect(dupes).toBe(0);
  });
});

test.describe("phone list (390 px)", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "mobile", "mobile project only");
  });

  test("line 1 is the name with the badge on the right, line 2 the trend and week, no overlap, rows at least 56 px", async ({
    page,
  }) => {
    await pinClock(page);
    await page.goto("/");
    await expect(page.locator("a[data-location-id]").first()).toBeVisible();
    await expect(page.locator(TABLE)).toHaveCount(0);
    const m = await page.evaluate(() => {
      const box = (el: Element | null) => {
        const r = el?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom } : null;
      };
      const out: Array<Record<string, unknown>> = [];
      for (const a of [...document.querySelectorAll<HTMLElement>("a[data-location-id]")].slice(0, 60)) {
        out.push({
          row: box(a),
          name: box(a.querySelector("[class*=rowName]")),
          badge: box(a.querySelector("[class*=rowBadge]")),
          sub: box(a.querySelector("[class*=rowSub]")),
        });
      }
      return { rows: out, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
    });
    type B = { x: number; y: number; w: number; h: number; r: number; b: number } | null;
    let withSub = 0;
    for (const o of m.rows as Array<{ row: B; name: B; badge: B; sub: B }>) {
      expect(o.row!.h).toBeGreaterThanOrEqual(55.5);
      const { name, badge, sub } = o;
      // Badge is right of the name, on the same line, not overlapping.
      expect(badge!.x).toBeGreaterThanOrEqual(name!.r - 1);
      expect(badge!.r).toBeLessThanOrEqual(o.row!.r + 1);
      expect(Math.abs(badge!.y + badge!.h / 2 - (name!.y + name!.h / 2))).toBeLessThan(Math.max(name!.h, badge!.h));
      if (sub) {
        withSub += 1;
        expect(sub.y).toBeGreaterThanOrEqual(Math.max(name!.b, badge!.b) - 1);
        expect(sub.x).toBeLessThanOrEqual(name!.x + 1);
      }
    }
    expect(withSub).toBeGreaterThan(0);
    expect(m.scrollW).toBeLessThanOrEqual(m.clientW);
  });
});
