/**
 * UI-20.18 to UI-20.28 (task 19.3): the "All places" table, its header sorting and the phone row.
 * Rows come from the real PHAC trend fixture; the no-monitoring-site row and the long name are `synthetic`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PlacesTable, ariaSortFor } from "../../src/components/landing/PlacesTable";
import { CityRow } from "../../src/components/landing/CityList";
import { LandingScreen, type LandingScreenProps } from "../../src/components/landing/LandingScreen";
import { buildLandingRows, type LandingRow } from "../../src/lib/view/landing-rows";
import { sortRows } from "../../src/lib/view/sort-rows";
import { SORT_KEYS, type ListSort, type SortKey } from "../../src/lib/view/sort-spec";
import { checkWording } from "../../src/evidence/wording-guard";
import type { LocationEntry } from "../../src/evidence/types";
import * as landingCopy from "../../src/ui-copy/landing";
import { loadTrendFixture, textOf } from "./helpers";

const TODAY = "2026-11-07";
const CSS = readFileSync(join(process.cwd(), "src/components/landing/Landing.module.css"), "utf8");

function realLocations(): LocationEntry[] {
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

/** synthetic: no PHAC rows, and a name long enough to need an ellipsis. */
const SYNTHETIC_NO_SITE: LocationEntry = {
  locationId: "synthetic-a-very-long-place-name-that-cannot-fit",
  locationName: "Synthetic Very Long Place Name That Cannot Possibly Fit In One Column",
  city: "Synthetic",
  province: "Synthetic Province",
  pruid: "00",
  grouping: "city",
  coverage: "no_city_site",
};

const ROWS: LandingRow[] = buildLandingRows({
  locations: [...realLocations(), SYNTHETIC_NO_SITE],
  observations: loadTrendFixture(),
  virus: "covid19",
  today: TODAY,
  showDiscontinued: true,
});
const noSiteRow = ROWS.find((r) => r.noSite)!;
const levelRow = ROWS.find((r) => !r.noSite && r.badge.kind === "level" && r.weekStart)!;

const NAME_ASC: ListSort = { key: "name", dir: "asc" };
const noop = () => {};

function table(over: Partial<React.ComponentProps<typeof PlacesTable>> = {}): string {
  return renderToStaticMarkup(
    createElement(PlacesTable, { rows: sortRows(ROWS, NAME_ASC), sort: NAME_ASC, onSort: noop, query: "", onQuery: noop, ...over }),
  );
}

describe("UI-20.19 UI-20.20 table markup", () => {
  const html = table();
  it("is a real table titled 'All places' with the six columns in order, in the city-list skip target", () => {
    expect(html).toContain('id="city-list"');
    expect(html).toMatch(/<h2[^>]*>All places<\/h2>/);
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    const heads = [...html.matchAll(/<th[^>]*scope="col"[^>]*><button[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(heads).toEqual(["City", "Province", "PHAC level", "Trend", "Sample week", "Freshness"]);
  });
  it("renders one row per place, each with one name link a[data-location-id]", () => {
    expect([...html.matchAll(/<a [^>]*data-location-id="/g)]).toHaveLength(ROWS.length);
    expect(html).toContain(`href="/city/${levelRow.location.locationId}"`);
  });
  it("level, trend, week and freshness cells use the PHAC values with words", () => {
    const row = new RegExp(`<tr[^>]*data-place-row="${levelRow.location.locationId}"[\\s\\S]*?</tr>`).exec(html)![0];
    const text = textOf(row);
    expect(row).toContain(`data-activity="${levelRow.badge.kind === "level" ? levelRow.badge.activity : ""}"`);
    expect(row).toContain("data-trend=");
    expect(row).toContain("data-lantern=");
    expect(text).toContain(`week of`);
    expect(row).toMatch(/class="[^"]*\bmono"[^>]*>week of/);
  });
  it("a no-monitoring-site row keeps its label and shows 'not available' text in the other cells", () => {
    const row = new RegExp(`<tr[^>]*data-place-row="${noSiteRow.location.locationId}"[\\s\\S]*?</tr>`).exec(html)![0];
    expect(textOf(row)).toContain("No monitoring site");
    expect((row.match(/visually-hidden">not available</g) ?? []).length).toBe(3);
    expect(row).not.toMatch(/data-activity=|data-trend=|data-lantern=/);
  });
  it("copy passes the wording guard", () => {
    for (const s of [
      landingCopy.PLACES_HEADING,
      landingCopy.PLACES_CAPTION,
      landingCopy.NOT_AVAILABLE,
      ...Object.values(landingCopy.PLACES_COLUMN_LABEL),
      ...SORT_KEYS.flatMap((key) => (["asc", "desc"] as const).map((dir) => landingCopy.sortedBy({ key, dir }))),
    ]) {
      expect(checkWording(s).violations, s).toEqual([]);
    }
    expect(landingCopy.sortedBy({ key: "level", dir: "desc" })).toBe("Sorted by PHAC level, highest first");
  });
});

describe("UI-20.21 aria-sort follows the sort (Property 33)", () => {
  it("exactly the active header has ascending or descending, all others none", () => {
    for (const key of SORT_KEYS) {
      for (const dir of ["asc", "desc"] as const) {
        const sort: ListSort = { key, dir };
        const html = table({ rows: sortRows(ROWS, sort), sort });
        const values = [...html.matchAll(/<th[^>]*aria-sort="([a-z]+)"[^>]*data-col="([a-z]+)"/g)].map((m) => [m[2], m[1]]);
        expect(values).toHaveLength(SORT_KEYS.length);
        for (const [col, v] of values) {
          expect(v, `${col} for ${key} ${dir}`).toBe(col === key ? (dir === "asc" ? "ascending" : "descending") : "none");
        }
      }
    }
    expect(ariaSortFor({ key: "week", dir: "desc" }, "week")).toBe("descending");
    expect(ariaSortFor({ key: "week", dir: "desc" }, "trend")).toBe("none");
  });
  it("header buttons are real buttons inside th scope=col", () => {
    expect(table()).toMatch(/<th scope="col" aria-sort="ascending"[^>]*><button type="button"/);
  });
});

describe("UI-20.23 search filters the table", () => {
  it("shows only the rows it is given and the empty message when there are none", () => {
    const one = [levelRow];
    const html = table({ rows: one, query: "x" });
    expect([...html.matchAll(/<a [^>]*data-location-id="/g)]).toHaveLength(1);
    expect(html).toContain('type="search"');
    const none = table({ rows: [], query: "zzz" });
    expect(textOf(none)).toContain("No matching locations");
    expect(none).not.toContain("<table");
  });
  it("keeps the search box and a status line while searching", () => {
    const html = table({ rows: [], query: "to", searching: true });
    expect(textOf(html)).toContain("Searching");
    expect(textOf(html)).not.toContain("No matching locations");
  });
});

describe("UI-20.26 long names ellipsize but keep the full name", () => {
  it("title and link text carry the full name; the CSS cuts it on one line", () => {
    const html = table();
    const full = SYNTHETIC_NO_SITE.locationName;
    expect(html).toContain(`title="${full}"`);
    expect(html).toContain(`>${full}</a>`);
    const rule = /\.nameLink\s*\{([^}]*)\}/.exec(CSS)![1]!;
    expect(rule).toMatch(/white-space:\s*nowrap/);
    expect(rule).toMatch(/text-overflow:\s*ellipsis/);
    expect(rule).toMatch(/overflow:\s*hidden/);
    expect(rule).toMatch(/max-width:/);
  });
});

describe("UI-20.27 a row opens the same drawer as the marker", () => {
  it("renders the row and its name link with the same location id the marker uses (click behaviour: e2e/sort.spec.ts, keyboard-and-viewport.spec.ts)", () => {
    const html = table({ rows: [levelRow], onOpen: noop });
    expect(html).toContain(`data-place-row="${levelRow.location.locationId}"`);
    expect(html).toContain(`data-location-id="${levelRow.location.locationId}"`);
    expect(html).toContain(`href="/city/${levelRow.location.locationId}"`);
  });
  it("selected row is highlighted and the link is aria-current", () => {
    const html = table({ rows: [levelRow], selectedId: levelRow.location.locationId });
    expect(html).toContain('aria-current="true"');
    expect(html).toMatch(/<tr class="[^"]*trSelected/);
  });
});

describe("UI-20.24 no inner scroll container; UI-20.18 no 340 px column", () => {
  const stripComments = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...stripComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.trim(), body: m[2]! }));
  const tableRules = rules.filter((r) => /\.(places|table|th|thButton|tr|tdName|tdClip|tdLevel|tdFresh|nameLink|list|body|mapCol)\b/.test(r.sel));

  it("no table, places, list or body rule sets overflow auto/scroll or a max-height", () => {
    expect(tableRules.length).toBeGreaterThan(5);
    for (const r of tableRules) {
      expect(r.body, r.sel).not.toMatch(/overflow(-y|-x)?:\s*(auto|scroll)/);
      expect(r.body, r.sel).not.toMatch(/(^|;|\s)max-height:/);
    }
  });
  it("the page has no 340 px column and no fixed list height", () => {
    expect(stripComments).not.toMatch(/\b340px\b/);
    expect(stripComments).not.toMatch(/\.rows\s*\{[^}]*overflow-y:\s*auto/);
  });
  it("the map panel spans the content width; its 16:9 stage is capped at 70vh and centred", () => {
    expect(stripComments).toMatch(/\.mapBox\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/);
    expect(stripComments).toMatch(/--map-max-h:\s*70vh/);
    expect(stripComments).toMatch(/\.mapBox\s*\{[^}]*margin-inline:\s*auto/);
  });
  it("cells are positioned so hidden text cannot extend the page (UI-20.2)", () => {
    expect(stripComments).toMatch(/\.table td\s*\{[^}]*position:\s*relative/);
    expect(stripComments).toMatch(/\.places\s*\{[^}]*position:\s*relative/);
  });
});

describe("UI-20.25 UI-20.28 one render path per width", () => {
  const props = (over: Partial<LandingScreenProps>): LandingScreenProps => ({
    virus: "covid19",
    onVirus: noop,
    phase: "ready",
    rows: ROWS,
    query: "",
    onQuery: noop,
    showDiscontinued: false,
    onDiscontinued: noop,
    wide: true,
    view: "list",
    onView: noop,
    mapShown: false,
    onToggleMap: noop,
    onOpen: noop,
    clocks: {},
    ...over,
  });
  it("table at 768 px and up, stacked list below; never both, so no duplicate links", () => {
    const wide = renderToStaticMarkup(createElement(LandingScreen, props({ table: true })));
    const narrow = renderToStaticMarkup(createElement(LandingScreen, props({ table: false, wide: false })));
    expect(wide).toContain("<table");
    expect(wide).not.toMatch(/<ul[^>]*rows/);
    expect(narrow).not.toContain("<table");
    expect(narrow).toMatch(/<ul[^>]*rows/);
    for (const html of [wide, narrow]) {
      const ids = [...html.matchAll(/<a [^>]*data-location-id="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size).toBe(ids.length);
      expect(html).not.toContain("Sort list");
    }
  });
  it("table works with the map absent (list view)", () => {
    const html = renderToStaticMarkup(createElement(LandingScreen, props({ table: true, view: "list" })));
    expect(html).not.toContain('data-map=""');
    expect(html).toContain("<table");
  });
  it("sort order comes from the sort prop", () => {
    const html = renderToStaticMarkup(
      createElement(LandingScreen, props({ table: true, sort: { key: "level", dir: "desc" } })),
    );
    expect(html).toMatch(/aria-sort="descending"[^>]*data-col="level"/);
  });

  it("phone row: name and badge on line 1, trend and week on line 2 (grid areas), at least 56 px", () => {
    const html = renderToStaticMarkup(createElement(CityRow, { row: levelRow }));
    const order = ["rowName", "rowBadge", "rowSub"].map((c) => html.indexOf(c));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const sub = /<span class="[^"]*rowSub[^"]*">([\s\S]*?)<\/span><\/a>/.exec(html)![1]!;
    expect(sub).toContain("data-trend=");
    expect(sub).toContain("week of");
    const badge = /rowBadge[^"]*">([\s\S]*?)<span class="[^"]*rowSub/.exec(html)![1]!;
    expect(badge).toContain("data-activity=");
    const row = /\.row\s*\{([^}]*)\}/.exec(CSS)![1]!;
    expect(row).toMatch(/min-height:\s*56px/);
    expect(row).toMatch(/grid-template-areas:\s*"name badge"\s*"sub sub"/);
    expect(/\.rowBadge\s*\{([^}]*)\}/.exec(CSS)![1]).toMatch(/justify-content:\s*flex-end/);
    expect(/\.rowSub\s*\{([^}]*)\}/.exec(CSS)![1]).toMatch(/justify-content:\s*flex-start/);
  });
  it("sort keys are exactly the six columns", () => {
    const keys: SortKey[] = ["name", "province", "level", "trend", "week", "freshness"];
    expect([...SORT_KEYS]).toEqual(keys);
  });
});
