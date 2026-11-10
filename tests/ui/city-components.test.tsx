/**
 * City components markup tests. Real PHAC fixture rows (trend-oct-2026.real.csv);
 * the history gaps are `synthetic`. UI-5.x, UI-6.x, UI-7.x.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCityView } from "../../src/lib/view/city-view";
import { buildTimeline } from "../../src/lib/view/timeline";
import { provenanceFor } from "../../src/lib/view/provenance";
import { resolveLocation } from "../../src/server/normalized-data";
import { TREND_SOURCE_URL } from "../../src/evidence/copy/sources";
import { ApiProvider } from "../../src/lib/api/provider";
import { VirusRow } from "../../src/components/city/VirusRow";
import { CoverageNotice } from "../../src/components/city/CoverageNotice";
import { ProvenanceTrigger } from "../../src/components/city/ProvenanceTrigger";
import { TimelineChart, PLOT } from "../../src/components/city/TimelineChart";
import { CityDetail, CityNotFound } from "../../src/components/city/CityDetail";
import { NOT_FOUND, HISTORY_ONLY } from "../../src/ui-copy/states";
import { loadTrendFixture, textOf } from "./helpers";
import type { StatusResponse } from "../../src/lib/api/schemas";
import type { MeasuredWeek } from "../../src/evidence/types";

const obs = loadTrendFixture();
const envelope = { snapshotId: obs[0]!.snapshotId, sampleWeek: "2026-10-18", sourceUrl: TREND_SOURCE_URL };

function statusFor(locationId: string, withAggregate = true): StatusResponse {
  const location = resolveLocation(locationId, obs);
  if (!location) throw new Error(`fixture location missing: ${locationId}`);
  const res: StatusResponse = {
    location,
    coverage: location.coverage,
    observations: obs.filter((o) => o.locationId === locationId),
  };
  if (withAggregate && location.coverage === "no_city_site" && location.provinceAggregate) {
    const id = location.provinceAggregate.locationId;
    res.provinceAggregate = { location: location.provinceAggregate, observations: obs.filter((o) => o.locationId === id) };
  }
  return res;
}

function rowsHtml(today: string): string {
  const status = statusFor("toronto");
  const view = buildCityView({ status, envelope, showRegional: false, today });
  return renderToStaticMarkup(
    <ul>
      {view.rows.map((r) => (
        <VirusRow key={r.pathogen} row={r} place={view.location.locationName} locationId="toronto" grouping="city" />
      ))}
    </ul>,
  );
}

describe("UI-5 city markup", () => {
  it("UI-5.2 UI-5.3 headline and signal levels carry separate labels, plus a provenance trigger per statement", () => {
    const html = rowsHtml("2026-10-22");
    const text = textOf(html);
    expect(text).toContain("PHAC viral activity level");
    expect(text).toContain("PHAC signal level");
    expect(text).toContain("week of Oct 18, 2026");
    expect(html.match(/<dialog/g)!.length).toBeGreaterThanOrEqual(4 * 4);
    expect(text).not.toContain("History only");
  });

  it("UI-5.13 delayed rows show the amber caution", () => {
    const html = rowsHtml("2026-11-10");
    expect(html).toContain('data-tone="caution"');
    expect(html).toContain('data-freshness="delayed"');
  });

  it("UI-5.12 outdated rows say history only", () => {
    const html = rowsHtml("2026-12-30");
    expect(textOf(html)).toContain(HISTORY_ONLY);
    expect(html).toContain('data-freshness="outdated"');
  });

  it("UI-5.5 UI-5.6 no_city_site with an aggregate offers the labelled toggle", () => {
    const status = statusFor("ottawa");
    const off = buildCityView({ status, envelope, showRegional: false, today: "2026-10-22" });
    expect(off.rows).toEqual([]);
    const html = renderToStaticMarkup(
      <CoverageNotice notice={off.notice} showingRegional={false} onToggleRegional={() => {}} />,
    );
    expect(textOf(html)).toContain("Show the provincial aggregate");
    const on = buildCityView({ status, envelope, showRegional: true, today: "2026-10-22" });
    const shown = textOf(
      renderToStaticMarkup(
        <CoverageNotice
          notice={on.notice}
          showingRegional
          regionName={on.regionName!}
          onToggleRegional={() => {}}
        />,
      ),
    );
    expect(shown).toContain(`Showing PHAC's ${on.regionName} provincial aggregate, not`);
  });

  it("UI-5.7 no_city_site without an aggregate says so and offers no toggle (synthetic: aggregate removed)", () => {
    const view = buildCityView({ status: statusFor("ottawa", false), envelope, showRegional: true, today: "2026-10-22" });
    expect(view.rows).toEqual([]);
    const text = textOf(renderToStaticMarkup(<CoverageNotice notice={view.notice} showingRegional={false} />));
    expect(text).toContain("No PHAC provincial aggregate is available");
    expect(text).not.toContain("Show the provincial aggregate");
  });

  it("UI-12.1 loading state shows a skeleton and no values", () => {
    const html = renderToStaticMarkup(
      <ApiProvider>
        <CityDetail locationId="toronto" variant="page" />
      </ApiProvider>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(textOf(html)).not.toMatch(/Moderate|High|Low|Not detected/);
  });

  it("UI-5.1 404 state names the problem and links back", () => {
    const html = renderToStaticMarkup(<CityNotFound className="x" headingId="h" control={null} />);
    expect(textOf(html)).toContain(NOT_FOUND);
    expect(html).toContain('href="/"');
  });
});

describe("UI-7 provenance trigger", () => {
  it("UI-7.1 UI-7.3 renders a closed native dialog whose body is not mounted until opened", () => {
    const view = buildCityView({ status: statusFor("toronto"), envelope, showRegional: false, today: "2026-10-22" });
    const stmt = view.rows[0]!.statement;
    const model = provenanceFor(stmt, "Viral_Activity_Level", {
      locationId: "toronto",
      grouping: "city",
      locationName: "Toronto",
    });
    const html = renderToStaticMarkup(<ProvenanceTrigger model={model} />);
    expect(html).toContain("<dialog");
    expect(html).not.toMatch(/<dialog[^>]*\sopen/);
    expect(html).toContain('aria-haspopup="dialog"');
    const text = textOf(html);
    for (const part of [model.snapshotId, model.ruleId, model.sourceUrl, "Published by PHAC", "Close"]) {
      expect(text).not.toContain(part);
    }
    expect(html).not.toContain("aria-labelledby");
  });
});

describe("UI-6 timeline chart", () => {
  const base: MeasuredWeek = {
    locationId: "toronto",
    pathogen: "fluA",
    weekStart: "2026-09-27",
    epiYear: 2026,
    epiWeek: 40,
    wAvg: 1,
    histMin: 0.5,
    histMax: 3,
  } as MeasuredWeek;
  // synthetic: weeks 2 and 4 missing, one null wAvg
  const weeks: MeasuredWeek[] = [
    { ...base, weekStart: "2026-09-06", wAvg: 1 },
    { ...base, weekStart: "2026-09-13", wAvg: 2 },
    { ...base, weekStart: "2026-09-27", wAvg: null },
    { ...base, weekStart: "2026-10-11", wAvg: 4 },
    { ...base, weekStart: "2026-10-18", wAvg: 3 },
  ];

  it("UI-6.1 to UI-6.7 renders focusable points, gaps, band, summary and a data table", () => {
    const model = buildTimeline({
      weeks,
      markers: [{ weekStart: "2026-10-18", activityIndex: "moderate" }],
      virus: "fluA",
      locationName: "Toronto",
      size: PLOT,
    });
    const html = renderToStaticMarkup(<TimelineChart model={model} virus="fluA" place="Toronto" />);
    expect(html.match(/<circle[^>]*tabindex="0"/g)).toHaveLength(model.line.flat().length);
    expect(html.match(/data-series="gap"/g)).toHaveLength(model.gapWeeks.length);
    expect(html).toContain('data-series="band"');
    expect(html).toContain('data-series="marker"');
    const text = textOf(html);
    expect(text).toContain(model.summary);
    expect(text).toContain(model.bandLabel);
    expect(html).toContain("<details");
    expect(html).toContain("<table");
  });

  it("UI-6.9 empty history shows the empty message, not a chart", () => {
    const model = buildTimeline({ weeks: [], markers: [], virus: "rsv", locationName: "Toronto", size: PLOT });
    const html = renderToStaticMarkup(<TimelineChart model={model} virus="rsv" place="Toronto" />);
    expect(html).not.toContain("<svg");
    expect(textOf(html)).toContain("No measured history");
  });
});
