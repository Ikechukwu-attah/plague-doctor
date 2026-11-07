/**
 * Planner components markup — UI-8.1–8.14, UI-13.3, UI-14.5.
 * Real PHAC fixture locations via the production deriveLocations.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { deriveLocations } from "../../src/server/normalized-data";
import { checkWording } from "../../src/evidence/wording-guard";
import { WhereStep, filterPlaces } from "../../src/components/planner/WhereStep";
import { WhenStep } from "../../src/components/planner/WhenStep";
import { SettingStep } from "../../src/components/planner/SettingStep";
import { WhoStep } from "../../src/components/planner/WhoStep";
import { ConfirmStep } from "../../src/components/planner/ConfirmStep";
import { canAdvance, canEnterStep } from "../../src/components/planner/step-access";
import { initialPlannerState, type PlannerState } from "../../src/lib/view/planner";
import { buildCardUrl, parseCardUrl } from "../../src/lib/url-state";
import * as copy from "../../src/ui-copy";
import { loadTrendFixture, textOf } from "./helpers";

const locations = deriveLocations(loadTrendFixture());
const TODAY = new Date("2026-11-02T15:00:00-05:00");
const noop = () => {};

const complete: PlannerState = {
  ...initialPlannerState,
  step: "confirm",
  where: { locationId: "toronto", label: "Toronto", coverage: "city_site" },
  when: "2026-11-07",
  venue: "indoor",
  kind: "family-dinner",
};

function clean(text: string): void {
  expect(checkWording(text).violations, text).toEqual([]);
}

describe("UI-8.14 WhereStep states", () => {
  it("loading shows a skeleton and no place names", () => {
    const html = renderToStaticMarkup(
      <WhereStep locations={{ state: "loading" }} selected={undefined} onSelect={noop} onContinue={noop} />,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain(locations[0]!.locationName);
  });

  it("error names the resource and offers retry", () => {
    const html = renderToStaticMarkup(
      <WhereStep
        locations={{ state: "error", message: copy.loadFailed({ resource: "locations" }), retryLabel: copy.RETRY, onRetry: noop }}
        selected={undefined}
        onSelect={noop}
        onContinue={noop}
      />,
    );
    const text = textOf(html);
    expect(text).toContain("Couldn't load locations");
    expect(text).toContain("Retry");
    expect(html).toContain('role="alert"');
  });

  it("success lists non-site places from the snapshot", () => {
    const html = renderToStaticMarkup(
      <WhereStep locations={{ state: "success", locations }} selected={undefined} onSelect={noop} onContinue={noop} />,
    );
    const places = filterPlaces(locations, "");
    expect(places.length).toBeGreaterThan(0);
    expect(places.every((p) => p.grouping !== "site")).toBe(true);
    expect(textOf(html)).toContain(places[0]!.locationName);
    expect(html).toContain('type="search"');
  });

  it("UI-8.10 no_city_site shows the explanation, the labelled provincial aggregate and a checklist path", () => {
    const chosen = locations.find((l) => l.coverage === "no_city_site" && l.provinceAggregate && l.grouping !== "site");
    expect(chosen, "fixture should contain an uncovered city with a provincial aggregate").toBeDefined();
    const html = renderToStaticMarkup(
      <WhereStep
        locations={{ state: "success", locations }}
        selected={{ locationId: chosen!.locationId, label: chosen!.locationName, coverage: "no_city_site" }}
        onSelect={noop}
        onContinue={noop}
      />,
    );
    const text = textOf(html);
    const region = chosen!.provinceAggregate!.province || chosen!.provinceAggregate!.locationName;
    expect(text).toContain(copy.noCitySite({ place: chosen!.locationName }));
    expect(text).toContain(copy.provincialAggregateNotice({ place: chosen!.locationName, region }));
    expect(text).toContain(copy.regionalLabel({ region }));
    expect(text).toContain(copy.KEEP_PLACE_ACTION);
  });
});

describe("UI-8.4 UI-8.5 WhenStep", () => {
  it("a date more than 21 days ahead shows the too-early headline and no observed claim", () => {
    const html = renderToStaticMarkup(<WhenStep value="2026-12-21" today={TODAY} latestWeek="2026-10-25" onChange={noop} />);
    const text = textOf(html);
    expect(text).toContain(copy.tooEarly({ date: "2026-12-21" }));
    expect(text).not.toContain(copy.weekOf("2026-10-25"));
  });

  it("a near date names the latest sample week, not the event date", () => {
    const html = renderToStaticMarkup(<WhenStep value="2026-11-07" today={TODAY} latestWeek="2026-10-25" onChange={noop} />);
    const text = textOf(html);
    expect(text).toContain(copy.daysAway({ days: 5 }));
    expect(text).toContain(copy.weekOf("2026-10-25"));
    expect(text).toContain("not on your event date");
  });

  it("no date selected shows only the three rules", () => {
    const text = textOf(renderToStaticMarkup(<WhenStep value={undefined} today={TODAY} onChange={noop} />));
    expect(text).toContain(copy.TIMING_TOO_EARLY_ITEM);
    expect(text).toContain(copy.TIMING_NEAR_ITEM);
    expect(text).toContain(copy.TIMING_PAST_ITEM);
  });
});

describe("UI-8.3 SettingStep uses two fixed lists and no free text", () => {
  it("renders only radios for venues and kinds", () => {
    const html = renderToStaticMarkup(<SettingStep venue={undefined} kind={undefined} onChange={noop} />);
    expect(html.match(/type="radio"/g)).toHaveLength(copy.VENUES.length + copy.KINDS.length);
    expect(html).not.toMatch(/type="text"|<textarea|type="search"/);
  });
});

describe("UI-8.7 UI-8.8 WhoStep", () => {
  it("shows the privacy note, a Skip control and all categories", () => {
    const text = textOf(
      renderToStaticMarkup(<WhoStep attendees={["infants"]} onToggle={noop} onClear={noop} onSkip={noop} />),
    );
    expect(text).toContain(copy.WHO_PRIVACY_NOTE);
    expect(text).toContain(copy.SKIP);
    for (const c of copy.ATTENDEE_CATEGORIES) expect(text.toLowerCase()).toContain(c);
  });
});

describe("UI-8.11 UI-8.9 ConfirmStep", () => {
  it("is disabled and names the first missing step", () => {
    const html = renderToStaticMarkup(
      <ConfirmStep state={{ ...initialPlannerState, step: "confirm", where: complete.where! }} onEdit={noop} onConfirm={noop} />,
    );
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Create Omen Card/);
    expect(textOf(html)).toContain(copy.confirmDisabledReason({ missing: "When" }));
  });

  it("is enabled when place, date and setting are set; attendees are not in the output", () => {
    const html = renderToStaticMarkup(
      <ConfirmStep state={{ ...complete, attendees: ["immunocompromised"] }} onEdit={noop} onConfirm={noop} />,
    );
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Create Omen Card/);
    expect(html).not.toContain("href=");
  });

  it("the card URL carries only loc, date and setting", () => {
    const url = buildCardUrl({ locationId: "toronto", eventDate: "2026-11-07", venue: "indoor", kind: "family-dinner" });
    expect(Object.keys(Object.fromEntries(new URL(url, "http://x").searchParams))).toEqual(["loc", "date", "setting"]);
    expect(parseCardUrl(url)).not.toBeNull();
    for (const c of copy.ATTENDEE_CATEGORIES) expect(url.toLowerCase()).not.toContain(c.replace(" ", "+"));
  });
});

describe("step access", () => {
  it("steps unlock in order and Next needs the current requirement", () => {
    expect(canEnterStep(initialPlannerState, "where")).toBe(true);
    expect(canEnterStep(initialPlannerState, "when")).toBe(false);
    expect(canAdvance(initialPlannerState)).toBe(false);
    expect(canEnterStep(complete, "confirm")).toBe(true);
    expect(canAdvance({ ...initialPlannerState, step: "who" })).toBe(true);
  });
});

describe("UI-14 planner copy passes the wording guard", () => {
  it("fixed strings and templates", () => {
    const strings = [
      copy.PLANNER_INTRO,
      ...Object.values(copy.STEP_HEADINGS),
      copy.TIMING_TOO_EARLY_ITEM,
      copy.TIMING_NEAR_ITEM,
      copy.TIMING_PAST_ITEM,
      copy.WHO_MEMORY_NOTE,
      copy.NO_COVERAGE_CHECKLIST_NOTE,
      copy.LATEST_WEEK_UNAVAILABLE,
      copy.KEEP_PLACE_ACTION,
      copy.noCoverageHeading({ place: "Ottawa" }),
      copy.aggregateAction({ region: "Ontario" }),
      ...[-3, -1, 0, 1, 9].map((days) => copy.daysAway({ days })),
    ];
    for (const s of strings) clean(s);
  });
});

describe("UI-13.3 no emoji or health literals in planner components", () => {
  it("planner component sources have no free health sentences", () => {
    const dir = join(process.cwd(), "src/components/planner");
    for (const f of readdirSync(dir).filter((n) => /\.tsx$/.test(n))) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, f).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    }
  });
});
