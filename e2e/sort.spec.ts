import { test, expect } from "@playwright/test";
import { pinClock } from "./helpers";

/** UI-20.21, UI-20.22 (task 19.3): the column headers sort the places table; the sort lives in the URL. */
test.describe("places table sort", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === "mobile", "the table is rendered from 768 px; the phone list has no sort control");
  });

  test("header buttons sort, aria-sort and the URL follow, and the order survives a reload", async ({ page }) => {
    await pinClock(page);
    await page.goto("/");
    const table = page.locator("table[data-places-table]");
    await expect(table).toBeVisible();
    await expect(page.getByLabel("Sort list")).toHaveCount(0);

    const header = (name: string) => table.getByRole("columnheader", { name });
    await expect(header("City")).toHaveAttribute("aria-sort", "ascending");
    await expect(header("PHAC level")).toHaveAttribute("aria-sort", "none");

    // First click: ascending by that column.
    await expect(async () => {
      await header("PHAC level").getByRole("button").click();
      await expect(page).toHaveURL(/sort=level(&|$)/, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(header("PHAC level")).toHaveAttribute("aria-sort", "ascending");
    await expect(header("City")).toHaveAttribute("aria-sort", "none");

    // Second click: descending, highest PHAC category first; rows without a level come last.
    await header("PHAC level").getByRole("button").click();
    await expect(page).toHaveURL(/sort=level%3Adesc/);
    await expect(header("PHAC level")).toHaveAttribute("aria-sort", "descending");
    const rows = await table.locator("tbody tr").evaluateAll((trs) =>
      trs.map((tr) => (tr.querySelector("[data-activity]") as HTMLElement | null)?.dataset.activity ?? "none"),
    );
    const firstUnknown = rows.findIndex((a) => a === "unknown" || a === "none");
    if (firstUnknown >= 0) for (const a of rows.slice(firstUnknown)) expect(["unknown", "none"]).toContain(a);
    const known = rows.slice(0, firstUnknown < 0 ? rows.length : firstUnknown);
    const rank: Record<string, number> = { high: 3, moderate: 2, low: 1, not_detected: 0 };
    expect(known.map((a) => rank[a])).toEqual([...known.map((a) => rank[a]!)].sort((a, b) => b - a));

    // Unknown stays last in the other direction too.
    await header("PHAC level").getByRole("button").click();
    await expect(page).toHaveURL(/sort=level(&|$)/);
    const asc = await table.locator("tbody tr").evaluateAll((trs) =>
      trs.map((tr) => (tr.querySelector("[data-activity]") as HTMLElement | null)?.dataset.activity ?? "none"),
    );
    expect(asc.at(-1)).toMatch(/unknown|none/);

    await header("PHAC level").getByRole("button").click();
    await expect(page).toHaveURL(/sort=level%3Adesc/);
    await page.reload();
    await expect(table).toBeVisible();
    await expect(header("PHAC level")).toHaveAttribute("aria-sort", "descending");

    // Back to City: ascending is the default and is not written to the URL.
    await header("City").getByRole("button").click();
    await expect(page).not.toHaveURL(/sort=/);
    await expect(header("City")).toHaveAttribute("aria-sort", "ascending");
  });

  test("the legacy sort=activity link opens as PHAC level, highest first", async ({ page }) => {
    await pinClock(page);
    await page.goto("/?virus=covid19&sort=activity");
    const table = page.locator("table[data-places-table]");
    await expect(table.getByRole("columnheader", { name: "PHAC level" })).toHaveAttribute("aria-sort", "descending");
  });

  test("announces the new order in the live region", async ({ page }) => {
    await pinClock(page);
    await page.goto("/");
    const table = page.locator("table[data-places-table]");
    await expect(table).toBeVisible();
    await expect(async () => {
      await table.getByRole("columnheader", { name: "Sample week" }).getByRole("button").click();
      await expect(page.getByRole("status").filter({ hasText: /Sorted by Sample week, (oldest|newest) first/ })).toHaveCount(
        1,
        { timeout: 2_000 },
      );
    }).toPass({ timeout: 20_000 });
  });
});
