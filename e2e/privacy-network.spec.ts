import { expect, test } from "@playwright/test";
import type { Request } from "@playwright/test";
import { NEAR_DATE, completePlanner, fetchLocations, pickCity, pinClock } from "./helpers";
import { ATTENDEE_CATEGORIES } from "../src/ui-copy/planner-options";

const LABELS = ["Older adults", "Infants", "Immunocompromised"] as const;

/** Every spelling an attendee category could take inside a URL or body. */
function needles(): string[] {
  const out = new Set<string>();
  for (const c of ATTENDEE_CATEGORIES) {
    out.add(c);
    out.add(encodeURIComponent(c));
    out.add(c.replace(/ /g, "+"));
    out.add(c.replace(/ /g, "-"));
    out.add(c.replace(/ /g, "_"));
  }
  return [...out].map((s) => s.toLowerCase());
}

test.describe("privacy and network (UI-15.2, UI-15.3, UI-8.7, UI-9.11, UI-10.3)", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await pinClock(page);
  });

  test("only same-origin GET requests are made and no attendee category leaves the page", async ({
    page,
    request,
    baseURL,
  }) => {
    const city = pickCity(await fetchLocations(request));
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    const seen: Request[] = [];
    page.on("request", (r) => seen.push(r));

    await page.goto("/");
    await expect(page.locator("a[data-location-id]").first()).toBeVisible();
    await page.goto(`/city/${encodeURIComponent(city.locationId)}`);
    await expect(page.locator("li[data-pathogen]").first()).toBeVisible();

    await completePlanner(page, { placeName: city.locationName, date: NEAR_DATE, attendees: LABELS });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(city.locationName);

    // On screen only: the chips are visible, with the in-memory-only note.
    for (const label of LABELS) await expect(page.getByRole("listitem").filter({ hasText: label }).first()).toBeVisible();

    // Share text, copied text, and the address bar carry no category.
    const shown = (await page.locator("pre").first().textContent()) ?? "";
    await page.getByRole("button", { name: "Copy share text" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(shown);

    // Saving without ticking "keep who is attending" stores no category.
    await page.getByRole("button", { name: "Save to this device" }).click();
    await expect(page.getByText("Saved to this device").first()).toBeVisible();
    const stored = await page.evaluate(() => JSON.stringify({ ...window.localStorage }));
    expect(stored.length).toBeGreaterThan(2);

    await page.waitForLoadState("networkidle");

    const haystacks: Array<[string, string]> = [
      ["page URL", page.url()],
      ["share text", shown],
      ["clipboard", copied],
      ["localStorage", stored],
    ];
    for (const r of seen) {
      haystacks.push([`request URL ${r.method()} ${r.url()}`, r.url()]);
      haystacks.push([`request body ${r.url()}`, r.postData() ?? ""]);
      haystacks.push([`request headers ${r.url()}`, JSON.stringify(await r.allHeaders())]);
    }
    for (const [where, text] of haystacks) {
      const lower = text.toLowerCase();
      for (const n of needles()) expect(lower.includes(n), `${where} contains "${n}"`).toBe(false);
    }

    // Same-origin GETs only (UI-15.3).
    for (const r of seen) {
      if (r.url().startsWith("data:") || r.url().startsWith("blob:")) continue;
      expect(new URL(r.url()).origin, `origin of ${r.url()}`).toBe(origin);
      expect(r.method(), `method of ${r.url()}`).toBe("GET");
    }
  });

  test("attendee choices are forgotten on reload", async ({ page, request }) => {
    const city = pickCity(await fetchLocations(request));
    await completePlanner(page, { placeName: city.locationName, date: NEAR_DATE, attendees: LABELS });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(city.locationName);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(city.locationName);
    for (const label of LABELS) {
      await expect(page.getByRole("listitem").filter({ hasText: new RegExp(`^${label}$`, "i") })).toHaveCount(0);
    }
  });
});
