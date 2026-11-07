/**
 * UI-2.1 UI-2.4 UI-2.5 UI-2.7 UI-2.8 UI-2.9 UI-2.10 UI-2.11 UI-12.1
 * Landing route: server shell, screen states (renderToStaticMarkup) and status derivation.
 * Fixtures are real PHAC rows (fixtures/*.real.csv); snapshots/rows marked synthetic are generated.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Suspense } from "react";
import { buildLandingRows } from "../../src/lib/view/landing-rows";
import { deriveLandingStatus, staleWeekFor } from "../../src/lib/view/landing-status";
import { CanadaMap } from "../../src/components/landing/CanadaMap";
import { LandingScreen } from "../../src/components/landing/LandingScreen";
import type { LandingScreenProps } from "../../src/components/landing/LandingScreen";
import { TREND_SOURCE_URL } from "../../src/evidence/copy/sources";
import type { LocationEntry, SourceSnapshot } from "../../src/evidence/types";
import { LANDING_HEADING, limitation, staleBanner } from "../../src/ui-copy";
import { loadTrendFixture, textOf } from "./helpers";

const TODAY = "2026-11-07";

function locations(): LocationEntry[] {
  const seen = new Map<string, LocationEntry>();
  for (const o of loadTrendFixture()) {
    if ((o.grouping !== "city" && o.grouping !== "site") || seen.has(o.locationId)) continue;
    seen.set(o.locationId, {
      locationId: o.locationId,
      locationName: o.locationName,
      city: o.city,
      province: o.province,
      pruid: o.pruid,
      grouping: o.grouping,
      coverage: o.grouping === "city" ? "city_site" : "site_only",
    });
  }
  return [...seen.values()];
}

const rows = buildLandingRows({
  locations: locations(),
  observations: loadTrendFixture(),
  virus: "covid19",
  today: TODAY,
  showDiscontinued: false,
});

const base: LandingScreenProps = {
  virus: "covid19",
  onVirus: () => {},
  phase: "ready",
  rows,
  query: "",
  onQuery: () => {},
  showDiscontinued: false,
  onDiscontinued: () => {},
  wide: true,
  view: "map",
  onView: () => {},
  mapShown: false,
  onToggleMap: () => {},
  mapComponent: CanadaMap,
  onOpen: () => {},
  clocks: {},
};
const render = (p: Partial<LandingScreenProps> = {}) =>
  renderToStaticMarkup(<LandingScreen {...base} {...p} />);

function snap(over: Partial<SourceSnapshot>): SourceSnapshot {
  return {
    snapshotId: "a".repeat(64),
    sourceUrl: TREND_SOURCE_URL,
    fetchedAt: "2026-11-02T12:00:00Z",
    origin: "live",
    schemaVersion: "synthetic",
    rowCount: 1,
    rejectedRows: 0,
    status: "valid",
    ...over,
  };
}

describe("UI-2.1 server shell", () => {
  it("page renders h1, limitation line and a Suspense boundary around the island", async () => {
    const mod = await import("../../src/app/page");
    const html = renderToStaticMarkup(<Suspense>{mod.default()}</Suspense>);
    expect(html).toContain(`<h1>${LANDING_HEADING.replace("'", "&#x27;")}</h1>`);
    expect(textOf(html)).toContain(limitation());
  });
});

describe("UI-2.4 UI-2.7 success", () => {
  it("shows four virus chips with one pressed, legend, list and map", () => {
    const html = render();
    expect(html.match(/aria-pressed="true"/g)?.length).toBeGreaterThanOrEqual(1);
    expect(html).toContain('data-map=""');
    expect(html).toContain('id="city-list"');
    expect(html).toContain("Map legend");
    for (const v of ["COVID-19", "Flu A", "Flu B", "RSV"]) expect(textOf(html)).toContain(v);
  });
  it("UI-3.11 mobile is list-first: no map until Show map is pressed", () => {
    const list = render({ wide: false });
    expect(list).not.toContain('data-map=""');
    expect(textOf(list)).toContain("Show map");
    expect(render({ wide: false, mapShown: true })).toContain('data-map=""');
  });
  it("desktop list view hides the map", () => {
    expect(render({ view: "list" })).not.toContain('data-map=""');
  });
});

describe("UI-2.8 UI-12.1 loading / UI-2.11 error / empty", () => {
  it("loading shows a skeleton and no rows, legend or map", () => {
    const html = render({ phase: "loading", rows: [] });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('id="city-list"');
    expect(html).not.toContain('data-map=""');
  });
  it("blocking error shows only the notice, no stale values", () => {
    const html = render({ phase: "error", rows: [], errorNotice: <p role="alert">Couldn&apos;t load locations</p> });
    expect(html).toContain("Couldn&#x27;t load locations");
    expect(html).not.toContain('id="city-list"');
  });
  it("empty list says so", () => {
    expect(textOf(render({ rows: [] }))).toContain("No locations in this snapshot");
  });
  it("searching with no rows shows Searching, not 'No matching locations'", () => {
    const t = textOf(render({ rows: [], query: "tor", searching: true }));
    expect(t).toContain("Searching");
    expect(t).not.toContain("No matching locations");
  });
  it("settled empty search says No matching locations", () => {
    expect(textOf(render({ rows: [], query: "zzz" }))).toContain("No matching locations");
  });
});

describe("UI-2.9 UI-2.10 stale banner", () => {
  it("shows 'Showing last verified data from week of {date}'", () => {
    const t = textOf(render({ staleWeek: "2026-10-18" }));
    expect(t).toContain(staleBanner({ week: "2026-10-18" }));
    expect(t).toMatch(/Showing last verified data from week of Oct 18, 2026/);
  });
  it("is absent without a stale week", () => {
    expect(textOf(render())).not.toContain("Showing last verified data");
  });
});

describe("UI-2.9 status derivation", () => {
  const observations = loadTrendFixture();
  it("latest week is the newest sample week; freshness comes from it and today only", () => {
    const s = deriveLandingStatus({ observations, snapshots: [], today: TODAY });
    expect(s.latestWeek).toBe(observations.map((o) => o.weekStart).filter(Boolean).sort().at(-1));
    const later = deriveLandingStatus({ observations, snapshots: [], today: "2027-06-01" });
    expect(later.freshness).toBe("outdated");
    expect(staleWeekFor({ status: later, loadFailedWithLastGood: false })).toBe(later.latestWeek);
  });
  it("no observations → no_data and no banner", () => {
    const s = deriveLandingStatus({ observations: [], snapshots: [], today: TODAY });
    expect(s.freshness).toBe("no_data");
    expect(staleWeekFor({ status: s, loadFailedWithLastGood: true })).toBeUndefined();
  });
  it("a newer rejected trend snapshot (synthetic) triggers the banner; an older one does not", () => {
    const valid = snap({ snapshotId: "1".repeat(64), fetchedAt: "2026-11-02T12:00:00Z" });
    const newer = snap({ snapshotId: "2".repeat(64), fetchedAt: "2026-11-03T12:00:00Z", status: "rejected" });
    const older = snap({ snapshotId: "3".repeat(64), fetchedAt: "2026-10-30T12:00:00Z", status: "rejected" });
    const args = { observations, trendSnapshotId: valid.snapshotId, today: "2026-11-04" };
    expect(deriveLandingStatus({ ...args, snapshots: [valid, newer] }).rejectedNewer).toBe(true);
    expect(deriveLandingStatus({ ...args, snapshots: [valid, older] }).rejectedNewer).toBe(false);
  });
  it("a failed refresh with last-good data shows the banner for the last-good week", () => {
    const s = deriveLandingStatus({ observations, snapshots: [], today: TODAY });
    expect(staleWeekFor({ status: s, loadFailedWithLastGood: true })).toBe(s.latestWeek);
    expect(staleWeekFor({ status: s, loadFailedWithLastGood: false })).toBeUndefined();
  });
});
