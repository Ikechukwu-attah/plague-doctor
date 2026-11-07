import { expect, test } from "@playwright/test";
import { escapeRegExp, fetchLocations, pickNoCitySite, pinClock } from "./helpers";
import { noCitySite } from "../src/ui-copy/coverage";
import { SHOW_REGIONAL, HIDE_REGIONAL } from "../src/ui-copy/city";

interface StatusBody {
  data: {
    location: { locationId: string };
    observations: Array<{ locationId: string }>;
    provinceAggregate?: { location: { locationId: string }; observations: Array<{ locationId: string }> };
  };
}

test.describe("no city site: provincial aggregate is offered, never substituted (UI-5.5 to UI-5.8)", () => {
  test.beforeEach(async ({ page }) => {
    await pinClock(page);
  });

  test("a place without a city site shows PHAC's labelled provincial aggregate only on request", async ({
    page,
    request,
  }) => {
    const place = pickNoCitySite(await fetchLocations(request));
    test.skip(!place, "The current snapshot has no place with a provincial aggregate and no city site");
    if (!place) return;
    const aggregate = place.provinceAggregate;
    expect(aggregate).toBeDefined();

    // API: no other location's rows are returned under this place or its aggregate.
    const res = await request.get(`/api/status?locationId=${encodeURIComponent(place.locationId)}`);
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as StatusBody;
    for (const o of body.data.observations) expect(o.locationId).toBe(place.locationId);
    if (body.data.provinceAggregate) {
      for (const o of body.data.provinceAggregate.observations) {
        expect(o.locationId).toBe(body.data.provinceAggregate.location.locationId);
      }
    }

    await page.goto(`/city/${encodeURIComponent(place.locationId)}`);
    await expect(page.getByRole("heading", { level: 1, name: place.locationName })).toBeVisible();
    await expect(page.getByText(noCitySite({ place: place.locationName }))).toBeVisible();

    // Before the toggle: no virus rows, so no values are shown for this place.
    await expect(page.locator("li[data-pathogen]")).toHaveCount(0);

    await page.getByRole("button", { name: SHOW_REGIONAL }).click();
    const labelled = new RegExp(`provincial aggregate, not ${escapeRegExp(place.locationName)}\\.`);
    await expect(page.getByText(labelled)).toBeVisible();
    await expect(page.getByRole("button", { name: HIDE_REGIONAL })).toHaveAttribute("aria-pressed", "true");

    // Every row now describes the aggregate's location id, not another city's.
    const rows = page.locator("li[data-pathogen]");
    await expect(rows.first()).toBeVisible();
    await rows.first().getByRole("button", { name: /Where does this come from/ }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(aggregate?.locationId ?? "");
    await expect(dialog).not.toContainText(place.locationId);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Toggling off removes the values again.
    await page.getByRole("button", { name: HIDE_REGIONAL }).click();
    await expect(page.locator("li[data-pathogen]")).toHaveCount(0);
  });
});
