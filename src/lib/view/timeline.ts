/**
 * Timeline view model (UI-6). Pure: no React, no I/O, no clock.
 *
 * Plots only measured weeks supplied by the caller. Null or missing weeks are
 * gaps (never interpolated, never zero). Nothing is drawn past the latest
 * supplied week (no forecast, no extrapolation). Units stay PHAC units.
 */
import type { Activity, MeasuredWeek, Pathogen, StatusObservation } from "@/evidence/types";
import { formatDisplayDate } from "@/evidence/date-utils";
import { levelLabel, virusLabel } from "@/ui-copy/levels";
import { weekOf } from "@/ui-copy/timing";

export interface TimelinePoint {
  weekStart: string;
  x: number;
  y: number;
  wAvg: number;
}
export interface BandPoint {
  weekStart: string;
  x: number;
  yMin: number;
  yMax: number;
}
export interface OfficialMarker {
  weekStart: string;
  x: number;
  activity: Activity;
  labelText: string;
}
export interface TimelineRow {
  weekStart: string;
  wAvg: number | null;
  histMin: number | null;
  histMax: number | null;
  /** Complete, dated tooltip text (UI-6.8). */
  tooltip: string;
}

export const BAND_LABEL =
  "Historical minimum and maximum recorded for this EpiWeek, not a typical range or forecast" as const;
export const Y_AXIS_TITLE = "Measured weekly average (PHAC units)";

export interface TimelineModel {
  empty: boolean;
  /** Runs of consecutive measured weeks; a run ends at any null or missing week. */
  line: TimelinePoint[][];
  band: BandPoint[][];
  /** Missing or null-wAvg weeks between the first and last supplied week. */
  gapWeeks: string[];
  markers: OfficialMarker[];
  domain: { startWeek: string; endWeek: string };
  yMax: number;
  bandLabel: typeof BAND_LABEL;
  yAxisTitle: string;
  summary: string;
  rows: TimelineRow[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Days since 1970-01-01 for a YYYY-MM-DD string (calendar arithmetic, no time zones). */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Inverse of dayNumber (civil-from-days). */
function isoFromDayNumber(n: number): string {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const yy = m <= 2 ? y + 1 : y;
  return `${String(yy).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function show(v: number | null): string {
  return v === null ? "not published" : String(v);
}

function tooltipFor(r: { weekStart: string; wAvg: number | null; histMin: number | null; histMax: number | null }): string {
  return `${weekOf(r.weekStart)}: ${show(r.wAvg)}; historical min ${show(r.histMin)}, max ${show(r.histMax)}`;
}

export function buildTimeline(input: {
  weeks: MeasuredWeek[];
  markers: Array<Pick<StatusObservation, "weekStart" | "activityIndex">>;
  virus: Pathogen;
  locationName: string;
  size: { w: number; h: number };
}): TimelineModel {
  const { virus, locationName, size } = input;

  // Unique, valid, ascending weeks.
  const byWeek = new Map<string, MeasuredWeek>();
  for (const w of input.weeks) {
    if (ISO.test(w.weekStart) && !byWeek.has(w.weekStart)) byWeek.set(w.weekStart, w);
  }
  const weeks = [...byWeek.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));

  const markerSrc = input.markers.filter((m) => ISO.test(m.weekStart));

  const rows: TimelineRow[] = weeks.map((w) => ({
    weekStart: w.weekStart,
    wAvg: w.wAvg,
    histMin: w.histMin,
    histMax: w.histMax,
    tooltip: tooltipFor(w),
  }));

  // Domain: only weeks that were supplied (history and markers).
  const allWeeks = [...weeks.map((w) => w.weekStart), ...markerSrc.map((m) => m.weekStart)].sort();
  const startWeek = allWeeks[0] ?? "";
  const endWeek = allWeeks[allWeeks.length - 1] ?? "";
  const startDay = startWeek ? dayNumber(startWeek) : 0;
  const span = endWeek ? dayNumber(endWeek) - startDay : 0;
  const xOf = (weekStart: string): number =>
    span === 0 ? 0 : ((dayNumber(weekStart) - startDay) / span) * size.w;

  // y scale from supplied values only.
  let top = 0;
  for (const w of weeks) {
    for (const v of [w.wAvg, w.histMax]) if (v !== null && v > top) top = v;
  }
  const yMax = top > 0 ? top : 1;
  const yOf = (v: number): number => size.h - (v / yMax) * size.h;

  // Runs: consecutive weeks exactly 7 days apart, all with values.
  const line: TimelinePoint[][] = [];
  const band: BandPoint[][] = [];
  let lineRun: TimelinePoint[] = [];
  let bandRun: BandPoint[] = [];
  let prevDay: number | undefined;
  const flushLine = (): void => {
    if (lineRun.length) line.push(lineRun);
    lineRun = [];
  };
  const flushBand = (): void => {
    if (bandRun.length) band.push(bandRun);
    bandRun = [];
  };
  for (const w of weeks) {
    const day = dayNumber(w.weekStart);
    const adjacent = prevDay !== undefined && day - prevDay === 7;
    prevDay = day;
    if (w.wAvg !== null) {
      if (!adjacent) flushLine();
      lineRun.push({ weekStart: w.weekStart, x: xOf(w.weekStart), y: yOf(w.wAvg), wAvg: w.wAvg });
    } else {
      flushLine();
    }
    if (w.histMin !== null && w.histMax !== null) {
      if (!adjacent) flushBand();
      bandRun.push({ weekStart: w.weekStart, x: xOf(w.weekStart), yMin: yOf(w.histMin), yMax: yOf(w.histMax) });
    } else {
      flushBand();
    }
  }
  flushLine();
  flushBand();

  // Gaps: missing grid weeks between supplied weeks, plus null wAvg weeks.
  const gapSet = new Set<string>();
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i]!;
    if (w.wAvg === null) gapSet.add(w.weekStart);
    const next = weeks[i + 1];
    if (next) {
      for (let d = dayNumber(w.weekStart) + 7; d < dayNumber(next.weekStart); d += 7) {
        gapSet.add(isoFromDayNumber(d));
      }
    }
  }
  const gapWeeks = [...gapSet].sort();

  // Markers: only supplied official weeks, fixed-colour diamond (C8).
  const seen = new Set<string>();
  const markers: OfficialMarker[] = [];
  for (const m of markerSrc) {
    if (seen.has(m.weekStart)) continue;
    seen.add(m.weekStart);
    markers.push({
      weekStart: m.weekStart,
      x: xOf(m.weekStart),
      activity: m.activityIndex,
      labelText: `Official PHAC level, ${weekOf(m.weekStart)}: ${levelLabel(m.activityIndex)}`,
    });
  }

  const label = virusLabel(virus);
  let summary: string;
  if (rows.length === 0) {
    summary = `${label} in ${locationName}: no measured history.`;
  } else {
    const latest = [...weeks].reverse().find((w) => w.wAvg !== null);
    const latestText = latest
      ? `Latest measured weekly average ${latest.wAvg} (PHAC units) in the ${weekOf(latest.weekStart)}.`
      : "No measured weekly average in this range.";
    summary =
      `${label} in ${locationName}, ${formatDisplayDate(startWeek)} to ${formatDisplayDate(endWeek)}. ` +
      `${latestText} ${gapWeeks.length} gap ${gapWeeks.length === 1 ? "week" : "weeks"} with no measurement.`;
  }

  return {
    empty: rows.length === 0,
    line,
    band,
    gapWeeks,
    markers,
    domain: { startWeek, endWeek },
    yMax,
    bandLabel: BAND_LABEL,
    yAxisTitle: Y_AXIS_TITLE,
    summary,
    rows,
  };
}
