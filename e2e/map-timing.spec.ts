import { expect, test } from "@playwright/test";
import type { Browser } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Task 17.14 (UI-19.28, UI-19.29, UI-19.38): time from navigation start to the first map marker, plus the
 * time the map panel box and the province outlines are visible, and a request waterfall.
 * Runs against a production build (never a dev server). Throttled run mimics the Lighthouse mobile
 * profile (CPU 4x, 1.6 Mbps, 150 ms RTT); the unthrottled run is the local baseline.
 *
 * PERF_RECORD=1 records numbers only (no budget assertions). Otherwise the budgets below apply.
 * PERF_RUNS sets the number of runs per profile (default 3).
 */

const RECORD = process.env.PERF_RECORD === "1";
const RUNS = Number(process.env.PERF_RUNS ?? 3);

/** Generous budgets (after-medians x ~1.5, with a CI-variance floor). Filled from the recorded "after" values. */
// After medians (5 runs): throttled 3478 ms, unthrottled 320 ms, skeleton panel 62-340 ms. Budgets are about 1.5x-2x.
const BUDGET_MS = { throttledFirstMarker: 6000, unthrottledFirstMarker: 2500, panelFirstPaint: 1000 };

const MARKER = "[data-map] button[data-location-id]";

interface Run {
  firstPanel: number | null; // skeleton or map panel present with a non-empty box
  mapBox: number | null; // [data-map] box visible
  outlines: number | null; // first province path in [data-map]
  firstMarker: number | null;
  cls: number;
  blankSamples: number; // rAF samples (after first paint) where the panel region held neither skeleton nor map
  requests: Array<{ name: string; start: number; end: number; bytes: number }>;
}

async function measure(browser: Browser, baseURL: string, throttle: boolean): Promise<Run> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-CA",
    timezoneId: "America/Toronto",
    baseURL,
  });
  const page = await context.newPage();
  await page.addInitScript((marker: string) => {
    const w = window as unknown as { __m: Record<string, number | null> & { cls: number; blank: number } };
    w.__m = { firstPanel: null, mapBox: null, outlines: null, firstMarker: null, cls: 0, blank: 0 };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
        if (!e.hadRecentInput) w.__m.cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    const visible = (el: Element | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const tick = () => {
      const now = performance.now();
      const panel = document.querySelector("[data-map-panel]");
      const box = document.querySelector("[data-map]");
      if (w.__m.firstPanel === null && visible(panel)) w.__m.firstPanel = now;
      if (w.__m.mapBox === null && visible(box)) w.__m.mapBox = now;
      if (w.__m.outlines === null && visible(document.querySelector("[data-map] svg path"))) w.__m.outlines = now;
      if (w.__m.firstMarker === null && visible(document.querySelector(marker))) w.__m.firstMarker = now;
      if (w.__m.firstPanel !== null && w.__m.firstMarker === null && !visible(panel)) w.__m.blank += 1;
      if (w.__m.firstMarker === null || now < 12000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, MARKER);

  if (throttle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }

  await page.goto("/", { waitUntil: "commit" });
  await page.locator(MARKER).first().waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForTimeout(500); // let late layout shifts report
  const result = await page.evaluate(() => {
    const w = window as unknown as { __m: Record<string, number | null> & { cls: number; blank: number } };
    return {
      m: w.__m,
      res: performance.getEntriesByType("resource").map((e) => {
        const r = e as PerformanceResourceTiming;
        return { name: new URL(r.name).pathname, start: r.startTime, end: r.responseEnd, bytes: r.encodedBodySize };
      }),
    };
  });
  await context.close();
  const m = result.m;
  return {
    firstPanel: m.firstPanel ?? null,
    mapBox: m.mapBox ?? null,
    outlines: m.outlines ?? null,
    firstMarker: m.firstMarker ?? null,
    cls: m.cls,
    blankSamples: m.blank,
    requests: result.res
      .filter((r) => /\/_next\/static\/chunks|\/api\//.test(r.name))
      .sort((a, b) => a.start - b.start),
  };
}

const median = (xs: Array<number | null>): number | null => {
  const v = xs.filter((x): x is number => x !== null).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)]! : null;
};

for (const throttle of [false, true]) {
  const label = throttle ? "throttled (CPU 4x, 1.6 Mbps, 150 ms)" : "unthrottled";
  test(`UI-19.28 time to first marker, ${label}`, async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "timing is measured once, at desktop width");
    test.setTimeout(RUNS * 90_000);
    const runs: Run[] = [];
    for (let i = 0; i < RUNS; i += 1) runs.push(await measure(browser, baseURL!, throttle));
    const summary = {
      profile: label,
      medianMs: {
        firstPanel: median(runs.map((r) => r.firstPanel)),
        mapBox: median(runs.map((r) => r.mapBox)),
        outlines: median(runs.map((r) => r.outlines)),
        firstMarker: median(runs.map((r) => r.firstMarker)),
      },
      cls: runs.map((r) => Number(r.cls.toFixed(4))),
      blankSamples: runs.map((r) => r.blankSamples),
      runs: runs.map((r) => ({
        firstPanel: r.firstPanel,
        mapBox: r.mapBox,
        outlines: r.outlines,
        firstMarker: r.firstMarker,
      })),
      waterfall: runs[Math.floor(runs.length / 2)]!.requests.map((r) => ({
        name: r.name.replace("/_next/static/chunks/", "chunk:"),
        startMs: Math.round(r.start),
        endMs: Math.round(r.end),
        bytes: r.bytes,
      })),
    };
    mkdirSync("test-results", { recursive: true });
    writeFileSync(`test-results/map-timing-${throttle ? "throttled" : "unthrottled"}.json`, JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    if (RECORD) return;

    const budget = throttle ? BUDGET_MS.throttledFirstMarker : BUDGET_MS.unthrottledFirstMarker;
    expect(summary.medianMs.firstMarker).not.toBeNull();
    expect(summary.medianMs.firstMarker!).toBeLessThan(budget);
    // The panel is never blank: a skeleton or the map is visible within 1 s of navigation (unthrottled).
    expect(summary.medianMs.firstPanel).not.toBeNull();
    if (!throttle) expect(summary.medianMs.firstPanel!).toBeLessThan(BUDGET_MS.panelFirstPaint);
    expect(Math.max(...summary.blankSamples)).toBe(0);
    expect(Math.max(...runs.map((r) => r.cls))).toBeLessThan(0.1);
  });
}
