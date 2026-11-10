import { expect, test } from "@playwright/test";
import { pinClock } from "./helpers";
import { NO_MONITORING_SITE } from "../src/ui-copy/coverage";

interface LocBody {
  data: Array<{ locationId: string; coverage: string }>;
}
interface StatusBody {
  data: { observations: Array<{ locationId: string }> };
}

test.describe("regional site: Vancouver is covered by PHAC's Metro Vancouver location (UI-19.8 to UI-19.11)", () => {
  test.beforeEach(async ({ page }) => {
    await pinClock(page);
  });

  test("the city page shows Metro Vancouver values labelled 'Regional site'", async ({ page, request }) => {
    const locations = (await (await request.get("/api/locations")).json()) as LocBody;
    const van = locations.data.find((l) => l.locationId === "vancouver");
    test.skip(!van || van.coverage !== "regional_site", "The current snapshot has no Metro Vancouver location");

    const status = (await (await request.get("/api/status?locationId=vancouver")).json()) as StatusBody;
    expect(status.data.observations.length).toBeGreaterThan(0);
    for (const o of status.data.observations) expect(o.locationId).toBe("metro-vancouver");

    await page.goto("/city/vancouver");
    await expect(page.getByRole("heading", { level: 1, name: "Vancouver" })).toBeVisible();
    const region = page.locator("[data-regional-site]");
    await expect(region.locator("[data-regional-label]")).toContainText("Regional site");
    await expect(region).toContainText("Vancouver is covered by PHAC's Metro Vancouver site");
    await expect(page.getByText(NO_MONITORING_SITE)).toHaveCount(0);
    await expect(page.locator("[data-pathogen]").first()).toBeVisible();

    await region.getByRole("button", { name: "About regional sites" }).click();
    await expect(page.getByRole("dialog")).toContainText("not the same as the city boundary");
  });
});
