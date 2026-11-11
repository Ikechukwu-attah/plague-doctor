import { expect, test } from "@playwright/test";
import { pinClock } from "./helpers";

// UI-20.29, UI-20.30. Viewports are set inside the test, so one project is enough.
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "viewport is set explicitly in these specs");
  await pinClock(page);
});

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const WIDTHS = [1440, 1024, 1000, 768, 390] as const;

for (const width of WIDTHS) {
  test(`UI-20.29 UI-20.30 controls row layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const row = page.locator("[data-controls-row]");
    await expect(row.getByRole("group", { name: "Virus" })).toBeVisible();
    // Controls only render once data is ready; wait for the discontinued toggle and the view control.
    await expect(row.getByRole("checkbox").first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Visible controls: each chip, each checkbox label, and the browse/map-toggle buttons.
    const boxes: { name: string; box: Box }[] = [];
    const items = row.locator("button, label");
    const n = await items.count();
    for (let i = 0; i < n; i++) {
      const el = items.nth(i);
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      if (!box || box.width === 0) continue;
      boxes.push({ name: ((await el.innerText()) || `#${i}`).trim(), box });
    }
    expect(boxes.length).toBeGreaterThanOrEqual(6);

    // No overlaps (1 px tolerance for sub-pixel rounding).
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlapX = Math.min(a.box.x + a.box.width, b.box.x + b.box.width) - Math.max(a.box.x, b.box.x);
        const overlapY = Math.min(a.box.y + a.box.height, b.box.y + b.box.height) - Math.max(a.box.y, b.box.y);
        expect(overlapX > 1 && overlapY > 1, `${a.name} overlaps ${b.name} at ${width}px`).toBe(false);
      }
    }

    // Nothing clipped by the viewport, no horizontal overflow.
    for (const { name, box } of boxes) {
      expect(box.x, `${name} left edge at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${name} right edge at ${width}px`).toBeLessThanOrEqual(width);
    }
    // Scoped to the controls row: map markers/labels outside it are covered by the map specs.
    const overflow = await row.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, `controls row overflow at ${width}px`).toBeLessThanOrEqual(0);

    // Every target keeps its 44 px height.
    for (const { name, box } of boxes) {
      expect(box.height, `${name} height at ${width}px`).toBeGreaterThanOrEqual(43.5);
    }

    if (width >= 1024) {
      const centres = boxes.map((b) => b.box.y + b.box.height / 2);
      const spread = Math.max(...centres) - Math.min(...centres);
      expect(spread, `vertical centre spread at ${width}px`).toBeLessThanOrEqual(6);
    } else {
      // Chips sit on their own line above the toggles.
      const chipBottom = Math.max(
        ...(await row.getByRole("group", { name: "Virus" }).getByRole("button").evaluateAll((els) =>
          els.map((e) => e.getBoundingClientRect().bottom),
        )),
      );
      const checks = await row.locator("label").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
      for (const top of checks) expect(top).toBeGreaterThanOrEqual(chipBottom - 1);
    }
  });
}
