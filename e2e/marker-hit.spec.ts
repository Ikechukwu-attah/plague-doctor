import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { pinClock } from "./helpers";

/** UI-19.1 (doc 16.1): the element under each marker's centre is that marker. */
async function showMap(page: Page): Promise<void> {
  await pinClock(page);
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Show map", exact: true });
  const first = page.locator("[data-map] button[data-location-id], [data-map] button[data-cluster-id]").first();
  // Below 640 px the map starts hidden; the toggle is server-rendered, so retry until hydration has attached its handler.
  await expect(async () => {
    if (await toggle.isVisible()) await toggle.click();
    await expect(first).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  // Clustering runs after the first ResizeObserver measurement.
  await page.waitForTimeout(300);
}

const ITEMS = "[data-map] button[data-location-id], [data-map] button[data-cluster-id]";

test.describe("marker hit targets (UI-19.1)", () => {
  test("elementFromPoint at every marker or cluster centre returns that same element", async ({ page }) => {
    await showMap(page);
    const bad = await page.evaluate((sel) => {
      const out: string[] = [];
      const map = document.querySelector("[data-map]") as HTMLElement;
      const box = map.getBoundingClientRect();
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        if (cx < box.left || cx > box.right || cy < box.top || cy > box.bottom) continue;
        if (cy < 0 || cy > window.innerHeight) el.scrollIntoView({ block: "center" });
        const r2 = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
        const owner = hit?.closest("button");
        if (owner !== el) out.push(el.getAttribute("data-location-id") ?? el.getAttribute("data-cluster-id") ?? "?");
      }
      return out;
    }, ITEMS);
    expect(bad).toEqual([]);
  });

  test("a cluster opens a chooser whose row opens that place; Escape closes and returns focus", async ({ page }) => {
    await showMap(page);
    const cluster = page.locator("[data-map] button[data-cluster-id]").first();
    await expect(cluster).toBeVisible();
    await expect(cluster).toHaveAttribute("aria-label", /^\d+ places/);
    await cluster.scrollIntoViewIfNeeded();
    await cluster.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: /places on the map/ });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(cluster).toBeFocused();

    await cluster.click();
    const row = dialog.locator("a[data-location-id]").first();
    const id = await row.getAttribute("data-location-id");
    await row.click();
    await expect(dialog).toBeHidden();
    // UI-5.9: below 768 px a chosen place opens its own page; at 768 px and up the landing page stays with a surface.
    const width = page.viewportSize()?.width ?? 0;
    if (width < 768) {
      await expect(page).toHaveURL(new RegExp(`/city/${id}(\\?|$)`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    } else {
      await expect(page.locator(`[data-map] button[data-location-id="${id}"], [data-map] button[data-cluster-id*="${id}"]`).first()).toBeAttached();
    }
  });
});
