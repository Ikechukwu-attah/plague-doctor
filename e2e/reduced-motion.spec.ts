import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { pinClock } from "./helpers";

test.describe("reduced motion (UI-13.5)", () => {
  test.beforeEach(async ({ page }) => {
    await pinClock(page);
  });

  const fogStyles = () =>
    Array.from(document.querySelectorAll("[data-fog-layer] [data-fog]")).map((spot) => {
      const drift = spot.firstElementChild as HTMLElement | null;
      return {
        kind: spot.getAttribute("data-fog"),
        animationName: drift ? getComputedStyle(drift).animationName : "none",
        transitionDuration: getComputedStyle(spot).transitionDuration,
      };
    });

  /** Below 640 px the map starts hidden behind "Show map"; open it so the fog is rendered. */
  async function revealMap(page: Page): Promise<void> {
    const show = page.getByRole("button", { name: "Show map" });
    if (await show.isVisible().catch(() => false)) await show.click();
    await page.locator("[data-fog-layer]").first().waitFor({ state: "attached", timeout: 5_000 });
  }

  test("fog is static and has no transitions when the user prefers reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("a[data-location-id]").first()).toBeVisible();
    await revealMap(page);
    const spots = await page.evaluate(fogStyles);
    expect(spots.length, "fog spots rendered").toBeGreaterThan(0);
    for (const s of spots) {
      expect(s.animationName, `fog ${s.kind} animation`).toBe("none");
      expect(s.transitionDuration.split(",").every((d) => parseFloat(d) === 0), `fog ${s.kind} transition`).toBe(true);
    }
  });

  test("fog drifts when motion is allowed, so the reduced-motion rule is what stops it", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.locator("a[data-location-id]").first()).toBeVisible();
    await revealMap(page);
    const spots = await page.evaluate(fogStyles);
    const fog = spots.filter((s) => s.kind !== "hatch");
    test.skip(fog.length === 0, "No fog spots with a PHAC level in the current data");
    for (const s of fog) expect(s.animationName, `fog ${s.kind} animation`).not.toBe("none");
  });

  test("no element on the landing page keeps a running animation under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("a[data-location-id]").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === "running" && a instanceof CSSAnimation)
        .map((a) => (a as CSSAnimation).animationName),
    );
    expect(running).toEqual([]);
  });
});
