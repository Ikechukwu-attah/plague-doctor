/**
 * UI-12.1 UI-12.2 UI-12.3 UI-12.4 UI-12.5 UI-12.6 UI-13.6 UI-17.1
 * Screen-state matrix (loading, empty, error/stale, success) for Landing, City, Planner,
 * Card and Methods, rendered with renderToStaticMarkup from the existing presentational components.
 * Observations are real PHAC fixture rows; rows made unknown are labelled `synthetic`.
 */
import { describe, it, expect } from "vitest";
import { Suspense } from "react";
import { readFileSync } from "fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiProvider } from "../../src/lib/api/provider";
import { buildLandingRows } from "../../src/lib/view/landing-rows";
import { buildCityView } from "../../src/lib/view/city-view";
import { buildCard } from "../../src/evidence/card";
import { buildCardView } from "../../src/lib/view/card-view";
import { resolveLocation } from "../../src/server/normalized-data";
import { TREND_SOURCE_URL } from "../../src/evidence/copy/sources";
import { LandingScreen } from "../../src/components/landing/LandingScreen";
import type { LandingScreenProps } from "../../src/components/landing/LandingScreen";
import { CityList } from "../../src/components/landing/CityList";
import { CityDetail, CityNotFound } from "../../src/components/city/CityDetail";
import { VirusRow } from "../../src/components/city/VirusRow";
import { CoverageNotice } from "../../src/components/city/CoverageNotice";
import { CardLoading } from "../../src/components/card/CardLoading";
import { Problem } from "../../src/components/card/CardScreen";
import { OmenCard } from "../../src/components/card/OmenCard";
import { MethodsView } from "../../src/components/methods/MethodsView";
import { WhereStep } from "../../src/components/planner/WhereStep";
import { WhenStep } from "../../src/components/planner/WhenStep";
import { SettingStep } from "../../src/components/planner/SettingStep";
import { WhoStep } from "../../src/components/planner/WhoStep";
import { ConfirmStep } from "../../src/components/planner/ConfirmStep";
import { initialPlannerState } from "../../src/lib/view/planner";
import ErrorBoundary from "../../src/app/error";
import NotFound from "../../src/app/not-found";
import Home from "../../src/app/page";
import {
  ERROR_HEADING,
  PAGE_NOT_FOUND,
  RETRY,
  errorArea,
  routeError,
  loadFailed,
} from "../../src/ui-copy/states";
import { checkWording } from "../../src/evidence/wording-guard";
import type { LocationEntry, StatusObservation } from "../../src/evidence/types";
import type { StatusResponse } from "../../src/lib/api/schemas";
import { OTTAWA, TODAY as CARD_TODAY, TORONTO, history } from "./card-helpers";
import { loadTrendFixture, textOf } from "./helpers";

const TODAY = "2026-11-07";
const noop = () => {};
const h1s = (html: string) => html.match(/<h1[\s>]/g)?.length ?? 0;

const obs = loadTrendFixture();
const envelope = { snapshotId: obs[0]!.snapshotId, sampleWeek: "2026-10-18", sourceUrl: TREND_SOURCE_URL };

/** synthetic: every observation of a real fixture row forced to PHAC's unknown (NA1). */
const unknownObs: StatusObservation[] = obs.map((o) => ({
  ...o,
  activityIndex: "unknown",
  unknownReason: "na1_new_site",
  signalLevel: "unknown",
  trend: "unknown",
}));

function locationsOf(list: StatusObservation[]): LocationEntry[] {
  const seen = new Map<string, LocationEntry>();
  for (const o of list) {
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

const knownRows = buildLandingRows({
  locations: locationsOf(obs),
  observations: obs,
  virus: "covid19",
  today: TODAY,
  showDiscontinued: false,
});
const unknownRows = buildLandingRows({
  locations: locationsOf(unknownObs),
  observations: unknownObs,
  virus: "covid19",
  today: TODAY,
  showDiscontinued: true,
});

const landingBase: LandingScreenProps = {
  virus: "covid19",
  onVirus: noop,
  phase: "ready",
  rows: knownRows,
  query: "",
  onQuery: noop,
  showDiscontinued: false,
  onDiscontinued: noop,
  wide: true,
  view: "map",
  onView: noop,
  mapShown: false,
  onToggleMap: noop,
  onOpen: noop,
  clocks: {},
};
const landing = (p: Partial<LandingScreenProps> = {}) =>
  renderToStaticMarkup(<LandingScreen {...landingBase} {...p} />);
const homeHtml = renderToStaticMarkup(<Suspense>{Home()}</Suspense>);

const KNOWN_LEVELS = /data-activity="(low|not_detected|moderate|high)"/;
const LEVEL_WORDS = /\b(Low|Not detected|Moderate|High)\b/;

function statusFor(locationId: string, list: StatusObservation[]): StatusResponse {
  const location = resolveLocation(locationId, list);
  if (!location) throw new Error(`fixture location missing: ${locationId}`);
  return { location, coverage: location.coverage, observations: list.filter((o) => o.locationId === locationId) };
}

describe("UI-12 Landing states", () => {
  it("UI-12.1 loading never shows values from a previous virus or location, even if rows are still passed", () => {
    const html = landing({ phase: "loading", rows: knownRows });
    expect(html).toContain('aria-busy="true"');
    for (const r of knownRows.slice(0, 10)) expect(html).not.toContain(r.location.locationName);
    expect(html).not.toMatch(KNOWN_LEVELS);
    expect(html).not.toContain('id="city-list"');
  });

  it("UI-12.2 UI-12.4 error shows only the named, retryable notice", () => {
    const html = landing({
      phase: "error",
      rows: knownRows,
      errorNotice: <p role="alert">{loadFailed({ resource: "locations" })} {RETRY}</p>,
    });
    const text = textOf(html);
    expect(text).toContain("Couldn't load locations");
    expect(text).toContain(RETRY);
    for (const r of knownRows.slice(0, 10)) expect(html).not.toContain(r.location.locationName);
  });

  it("UI-12.3 empty says so; stale is dated", () => {
    expect(textOf(landing({ rows: [] }))).toContain("No locations in this snapshot");
    expect(textOf(landing({ staleWeek: "2026-10-18" }))).toContain("Showing last verified data from week of Oct 18, 2026");
  });

  it("UI-12.6 unknown rows are never Low, Not detected or a level colour", () => {
    expect(unknownRows.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(
      <CityList rows={unknownRows} query="" onQuery={noop} onOpen={noop} />,
    );
    expect(html).toContain('data-activity="unknown"');
    expect(html).not.toMatch(KNOWN_LEVELS);
    expect(textOf(html)).not.toMatch(LEVEL_WORDS);
    expect(textOf(html)).toContain("No data");
  });

  it("UI-13.6 the route has exactly one h1 (server shell) and the screen adds none", () => {
    for (const phase of ["loading", "error", "ready"] as const) {
      expect(h1s(landing({ phase }))).toBe(0);
    }
    expect(h1s(homeHtml)).toBe(1);
  });
});

describe("UI-12 City states", () => {
  const cityHtml = (id: string) =>
    renderToStaticMarkup(
      <ApiProvider>
        <CityDetail locationId={id} variant="page" />
      </ApiProvider>,
    );

  it("UI-12.1 loading shows a skeleton, one h1, and nothing from another location or virus", () => {
    const html = cityHtml("ottawa");
    expect(html).toContain('aria-busy="true"');
    expect(h1s(html)).toBe(1);
    expect(html.toLowerCase()).not.toContain("toronto");
    expect(html).not.toMatch(KNOWN_LEVELS);
    expect(textOf(html)).not.toMatch(LEVEL_WORDS);
  });

  it("UI-12.5 not found names the problem, has one h1 and links back", () => {
    const html = renderToStaticMarkup(<CityNotFound className="x" headingId="h" control={null} />);
    expect(h1s(html)).toBe(1);
    expect(html).toContain('href="/"');
  });

  it("UI-12.3 empty: a city with no site and no aggregate gives words, not values (synthetic: aggregate removed)", () => {
    const view = buildCityView({ status: statusFor("ottawa", obs), envelope, showRegional: true, today: "2026-10-22" });
    expect(view.rows).toEqual([]);
    const html = renderToStaticMarkup(<CoverageNotice notice={view.notice} showingRegional={false} />);
    expect(html).not.toMatch(KNOWN_LEVELS);
    expect(h1s(html)).toBe(0);
  });

  it("UI-12.6 success with PHAC-unknown values renders No data, never a level", () => {
    const view = buildCityView({
      status: statusFor("toronto", unknownObs),
      envelope,
      showRegional: false,
      today: "2026-10-22",
    });
    expect(view.rows.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(
      <ul>
        {view.rows.map((r) => (
          <VirusRow key={r.pathogen} row={r} place="Toronto" locationId="toronto" grouping="city" />
        ))}
      </ul>,
    );
    expect(html).toContain('data-activity="unknown"');
    expect(html).not.toMatch(KNOWN_LEVELS);
    expect(textOf(html)).toContain("No data");
    expect(textOf(html)).not.toMatch(LEVEL_WORDS);
    expect(h1s(html)).toBe(0);
  });
});

describe("UI-12 Planner states", () => {
  const where = { locationId: "toronto", label: "Toronto", coverage: "city_site" as const };

  it("UI-12.1 loading shows a skeleton and no place names", () => {
    const html = renderToStaticMarkup(
      <WhereStep locations={{ state: "loading" }} selected={undefined} onSelect={noop} onContinue={noop} />,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Toronto");
  });

  it("UI-12.2 UI-12.4 error names the resource and offers retry", () => {
    const html = renderToStaticMarkup(
      <WhereStep
        locations={{ state: "error", message: loadFailed({ resource: "locations" }), retryLabel: RETRY, onRetry: noop }}
        selected={undefined}
        onSelect={noop}
        onContinue={noop}
      />,
    );
    expect(textOf(html)).toContain("Couldn't load locations");
    expect(textOf(html)).toContain(RETRY);
  });

  it("UI-12.3 empty list is handled and no step renders an h1 (the page owns it)", () => {
    const steps = [
      renderToStaticMarkup(<WhereStep locations={{ state: "success", locations: [] }} selected={undefined} onSelect={noop} onContinue={noop} />),
      renderToStaticMarkup(<WhenStep value={undefined} today={new Date("2026-11-02T15:00:00-05:00")} onChange={noop} />),
      renderToStaticMarkup(<SettingStep venue={undefined} kind={undefined} onChange={noop} />),
      renderToStaticMarkup(<WhoStep attendees={[]} onToggle={noop} onClear={noop} onSkip={noop} />),
      renderToStaticMarkup(<ConfirmStep state={{ ...initialPlannerState, step: "confirm", where }} onEdit={noop} onConfirm={noop} />),
    ];
    for (const s of steps) expect(h1s(s)).toBe(0);
    expect(readFileSync("src/app/plan/page.tsx", "utf8").match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it("UI-12.6 success: a place with no site is explained, with no level shown", () => {
    const html = renderToStaticMarkup(
      <WhereStep
        locations={{ state: "success", locations: [OTTAWA] }}
        selected={{ locationId: "ottawa", label: "Ottawa", coverage: "no_city_site" }}
        onSelect={noop}
        onContinue={noop}
      />,
    );
    expect(html).not.toMatch(KNOWN_LEVELS);
  });
});

describe("UI-12 Card states", () => {
  const SETTING = "indoor.family-dinner";
  const unknownCard = (offsetDays: number) => {
    const d = new Date(CARD_TODAY + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return buildCard(
      {
        locationId: "toronto",
        eventDate: d.toISOString().slice(0, 10),
        setting: SETTING,
        attendeeCategories: [],
        createdAt: "2026-10-31T15:00:00.000Z",
        today: CARD_TODAY,
      },
      { observations: unknownObs, history: history(), locationEntry: TORONTO },
    );
  };

  it("UI-12.1 loading shows a shimmer, one h1 and no values", () => {
    const html = renderToStaticMarkup(<CardLoading />);
    expect(html).toContain('aria-busy="true"');
    expect(h1s(html)).toBe(1);
    expect(html).not.toMatch(KNOWN_LEVELS);
  });

  it("UI-12.2 UI-12.4 error names the problem, offers retry and the checklist, one h1", () => {
    const html = renderToStaticMarkup(
      <Problem retry={noop} retryLabel={RETRY}>
        {loadFailed({ resource: "status" })}
      </Problem>,
    );
    expect(h1s(html)).toBe(1);
    expect(textOf(html)).toContain("Couldn't load status");
    expect(textOf(html)).toContain(RETRY);
    expect(html).not.toMatch(KNOWN_LEVELS);
  });

  it("UI-12.3 empty: no data still gives a card with one h1 and no invented level", () => {
    const card = buildCard(
      {
        locationId: "toronto",
        eventDate: CARD_TODAY,
        setting: SETTING,
        attendeeCategories: [],
        createdAt: "2026-10-31T15:00:00.000Z",
        today: CARD_TODAY,
      },
      { observations: [], history: [], locationEntry: TORONTO },
    );
    const html = renderToStaticMarkup(<OmenCard view={buildCardView(card, CARD_TODAY)} />);
    expect(h1s(html)).toBe(1);
    expect(html).not.toMatch(KNOWN_LEVELS);
    expect(textOf(html)).not.toMatch(/\bNot detected\b/);
  });

  it("UI-12.6 success with PHAC-unknown values (near, too early, past): one h1, never a level", () => {
    for (const offset of [3, 60, -200]) {
      const html = renderToStaticMarkup(<OmenCard view={buildCardView(unknownCard(offset), CARD_TODAY)} />);
      expect(h1s(html), String(offset)).toBe(1);
      expect(html, String(offset)).not.toMatch(KNOWN_LEVELS);
      expect(textOf(html), String(offset)).not.toMatch(/\bNot detected\b/);
    }
  });

  it("UI-12.5 an uncovered city is labelled and carries no level of its own", () => {
    const html = renderToStaticMarkup(
      <OmenCard view={buildCardView(buildCard(
        {
          locationId: "ottawa",
          eventDate: CARD_TODAY,
          setting: SETTING,
          attendeeCategories: [],
          createdAt: "2026-10-31T15:00:00.000Z",
          today: CARD_TODAY,
        },
        { observations: [], history: [], locationEntry: OTTAWA },
      ), CARD_TODAY)} />,
    );
    expect(html).not.toMatch(KNOWN_LEVELS);
  });
});

describe("UI-12 Methods states", () => {
  const facts = { locations: 5, byGrouping: { site: 2, city: 1, province: 1, national: 1 }, withoutCoverage: 3, discontinued: 1 };

  it("UI-12.1 loading: static prose plus skeletons, no figures", () => {
    const html = renderToStaticMarkup(<MethodsView clocks={null} coverage={null} />);
    expect((html.match(/aria-busy="true"/g) ?? []).length).toBe(2);
    expect(h1s(html)).toBe(1);
    expect(textOf(html)).not.toContain("This snapshot lists");
  });

  it("UI-12.3 empty clocks say unavailable, never a date or zero", () => {
    const t = textOf(renderToStaticMarkup(<MethodsView clocks={{}} coverage={null} />));
    expect(t).toContain("unavailable");
  });

  it("UI-12.2 UI-12.4 error names the failed resource, offers retry, keeps one h1", () => {
    const html = renderToStaticMarkup(
      <MethodsView
        clocks={{}}
        coverage={null}
        loadErrors={[loadFailed({ resource: "snapshots" })]}
        retry={<button type="button">{RETRY}</button>}
      />,
    );
    expect(h1s(html)).toBe(1);
    expect(textOf(html)).toContain("Couldn't load snapshots");
    expect(textOf(html)).toContain(RETRY);
  });

  it("UI-12.6 success shows derived counts with one h1", () => {
    const html = renderToStaticMarkup(<MethodsView clocks={{ sampleWeek: "2026-10-18" }} coverage={facts} />);
    expect(h1s(html)).toBe(1);
    expect(textOf(html)).toContain("This snapshot lists 5 locations");
  });
});

describe("UI-12 route error boundary and not-found", () => {
  it("UI-12.2 names the failing area per route and wording passes the guard", () => {
    expect(errorArea("/")).toBe("the map");
    expect(errorArea("/city/toronto")).toBe("the city page");
    expect(errorArea("/plan")).toBe("the gathering planner");
    expect(errorArea("/card")).toBe("the Omen Card");
    expect(errorArea("/methods")).toBe("Behind the mask");
    for (const area of ["the map", "the city page", "the gathering planner", "the Omen Card", "Behind the mask"]) {
      expect(checkWording(routeError({ area })).violations).toEqual([]);
    }
    expect(checkWording(ERROR_HEADING).violations).toEqual([]);
  });

  it("UI-13.6 error boundary and not-found each render one h1 and leak no internals", () => {
    expect(typeof ErrorBoundary).toBe("function");
    const nf = renderToStaticMarkup(<NotFound />);
    expect(h1s(nf)).toBe(1);
    expect(textOf(nf)).toContain(PAGE_NOT_FOUND);
    expect(nf).toContain('href="/"');
  });

  it("UI-12.2 error boundary source retries through reset and never prints error details", () => {
    const src = readFileSync("src/app/error.tsx", "utf8");
    expect(src).toContain("onClick={reset}");
    expect(src).not.toMatch(/error\.(message|stack|digest)/);
  });
});
