import { expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

/** Fixed "today" for deterministic freshness maths (UI-14.8). */
export const TEST_NOW = "2026-11-02T15:00:00-05:00";

/**
 * Pins the app clock. Only effective because the e2e server is built with
 * NEXT_PUBLIC_PD_TEST_CLOCK=1. Call before page.goto().
 */
export async function pinClock(page: Page, now: string = TEST_NOW): Promise<void> {
  await page.addInitScript((iso: string) => {
    window.__PD_TEST_NOW__ = iso;
  }, now);
}

/** Subset of /api/locations entries the specs rely on (read at runtime, never hardcoded). */
export interface LocationLite {
  locationId: string;
  locationName: string;
  province: string;
  grouping: "site" | "city" | "province" | "national";
  coverage: "city_site" | "site_only" | "no_city_site" | "province_aggregate" | "national";
  provinceAggregate?: LocationLite;
}

/** Dates relative to the pinned clock (2026-11-02): near, too early (> 21 days), past. */
export const NEAR_DATE = "2026-11-10";
export const FAR_DATE = "2027-03-15";
export const PAST_DATE = "2026-09-14";
export const SETTING = "indoor.family-dinner";

export async function fetchLocations(request: APIRequestContext): Promise<LocationLite[]> {
  const res = await request.get("/api/locations");
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { data: LocationLite[] };
  return body.data;
}

/** A covered city, preferring Toronto when the current snapshot has it. */
export function pickCity(locs: readonly LocationLite[]): LocationLite {
  const cities = locs.filter((l) => l.coverage === "city_site" && l.grouping === "city");
  const found = cities.find((l) => l.locationName === "Toronto") ?? cities[0];
  if (!found) throw new Error("No city-level location in /api/locations");
  return found;
}

/** A place with no city site and a PHAC provincial aggregate, preferring Ottawa when it qualifies. */
export function pickNoCitySite(locs: readonly LocationLite[]): LocationLite | undefined {
  const gaps = locs.filter((l) => l.coverage === "no_city_site" && l.provinceAggregate);
  return gaps.find((l) => l.locationName === "Ottawa") ?? gaps[0];
}

export function cardUrl(locationId: string, date: string, setting: string = SETTING): string {
  const sp = new URLSearchParams({ loc: locationId, date, setting });
  return `/card?${sp.toString()}`;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Drives the planner through the UI to the Card route. `attendees` are tick-box labels. */
export async function completePlanner(
  page: Page,
  opts: { placeName: string; date: string; attendees?: readonly string[] },
): Promise<void> {
  await page.goto("/plan");
  await page.getByLabel("Search places").fill(opts.placeName);
  await page
    .getByRole("list", { name: "Places" })
    .getByRole("button")
    .filter({ hasText: opts.placeName })
    .first()
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Date of your gathering").fill(opts.date);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("radio", { name: "Indoor", exact: true }).check();
  await page.getByRole("radio", { name: "Family dinner", exact: true }).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  if (opts.attendees && opts.attendees.length > 0) {
    for (const a of opts.attendees) await page.getByRole("checkbox", { name: a, exact: true }).check();
    await page.getByRole("button", { name: "Next", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Skip", exact: true }).click();
  }
  await page.getByRole("button", { name: "Create Omen Card" }).click();
  await page.waitForURL(/\/card\?/);
}
