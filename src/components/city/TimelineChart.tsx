"use client";
import { useState } from "react";
import type { Pathogen } from "@/evidence/types";
import type { TimelineModel } from "@/lib/view/timeline";
import {
  TIMELINE_EMPTY,
  TIMELINE_LEGEND_GAP,
  TIMELINE_LEGEND_LINE,
  TIMELINE_LEGEND_MARKER,
  TIMELINE_NOT_PUBLISHED,
  TIMELINE_TABLE_MAX,
  TIMELINE_TABLE_MIN,
  TIMELINE_TABLE_SUMMARY,
  TIMELINE_TABLE_VALUE,
  TIMELINE_TABLE_WEEK,
  timelineAxisDate,
  timelineChartLabel,
} from "@/ui-copy/city";
import { TimelineSummary } from "./TimelineSummary";
import styles from "./City.module.css";

/** Plot area and margins, in SVG user units. */
export const PLOT = { w: 640, h: 200 } as const;
const M = { left: 52, right: 12, top: 12, bottom: 32 } as const;

function dayNum(iso: string): number {
  return Date.parse(`${iso}T12:00:00Z`) / 86_400_000;
}

function cell(v: number | null): string {
  return v === null ? TIMELINE_NOT_PUBLISHED : String(v);
}

export interface TimelineChartProps {
  model: TimelineModel;
  virus: Pathogen;
  place: string;
  /** Recent-weeks sentence appended to the chart's text alternative (UI-19.21). */
  recentSummary?: string;
}

/**
 * Hand-written SVG. Points are keyboard-focusable; gaps are drawn as breaks in
 * the line plus ticks; nothing is drawn past the latest supplied week.
 */
export function TimelineChart({ model, virus, place, recentSummary }: TimelineChartProps) {
  const [active, setActive] = useState<string | null>(null);
  if (model.empty) return <p className={styles.muted}>{TIMELINE_EMPTY}</p>;

  const { startWeek, endWeek } = model.domain;
  const span = dayNum(endWeek) - dayNum(startWeek);
  const gx = (w: string): number => (span === 0 ? 0 : ((dayNum(w) - dayNum(startWeek)) / span) * PLOT.w);
  const rowByWeek = new Map(model.rows.map((r) => [r.weekStart, r]));
  const activeRow = active ? rowByWeek.get(active) : undefined;

  const bandPath = (run: TimelineModel["band"][number]): string => {
    const top = run.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.yMax.toFixed(1)}`);
    const bottom = [...run].reverse().map((p) => `L${p.x.toFixed(1)} ${p.yMin.toFixed(1)}`);
    return `${top.join(" ")} ${bottom.join(" ")} Z`;
  };

  return (
    <figure className={styles.chart}>
      <svg
        viewBox={`0 0 ${PLOT.w + M.left + M.right} ${PLOT.h + M.top + M.bottom}`}
        className={styles.chartSvg}
        role="group"
        aria-label={timelineChartLabel({ virus, place })}
      >
        <g transform={`translate(${M.left} ${M.top})`}>
          <line x1={0} y1={PLOT.h} x2={PLOT.w} y2={PLOT.h} className={styles.axis} />
          <line x1={0} y1={0} x2={0} y2={PLOT.h} className={styles.axis} />
          <text x={-8} y={PLOT.h} textAnchor="end" className={styles.tick}>
            0
          </text>
          <text x={-8} y={10} textAnchor="end" className={styles.tick}>
            {model.yMax.toFixed(2)}
          </text>
          <text x={0} y={PLOT.h + 20} className={styles.tick}>
            {timelineAxisDate({ date: startWeek })}
          </text>
          <text x={PLOT.w} y={PLOT.h + 20} textAnchor="end" className={styles.tick}>
            {timelineAxisDate({ date: endWeek })}
          </text>

          {model.band.map((run, i) => (
            <path key={`b${i}`} d={bandPath(run)} className={styles.band} data-series="band" />
          ))}
          {model.gapWeeks.map((w) => (
            <line key={`g${w}`} x1={gx(w)} x2={gx(w)} y1={0} y2={PLOT.h} className={styles.gap} data-series="gap" />
          ))}
          {model.line.map((run, i) => (
            <polyline
              key={`l${i}`}
              points={run.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              className={styles.line}
              data-series="line"
            />
          ))}
          {model.line.flat().map((p) => (
            <circle
              key={p.weekStart}
              cx={p.x}
              cy={p.y}
              r={active === p.weekStart ? 6 : 4}
              tabIndex={0}
              role="img"
              aria-label={rowByWeek.get(p.weekStart)?.tooltip}
              className={styles.point}
              data-week={p.weekStart}
              onFocus={() => setActive(p.weekStart)}
              onBlur={() => setActive(null)}
              onMouseEnter={() => setActive(p.weekStart)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
          {model.markers.map((m) => (
            <g key={`m${m.weekStart}`} transform={`translate(${m.x} ${PLOT.h + 2})`} data-series="marker">
              <title>{m.labelText}</title>
              <rect x={-5} y={-5} width={10} height={10} transform="rotate(45)" className={styles.marker} />
            </g>
          ))}
        </g>
      </svg>
      <div className={styles.tooltip} role="status" aria-live="polite">
        {activeRow ? activeRow.tooltip : null}
      </div>
      <ul className={styles.legend}>
        <li>{TIMELINE_LEGEND_LINE}</li>
        <li>{model.bandLabel}</li>
        <li>{TIMELINE_LEGEND_GAP}</li>
        <li>{TIMELINE_LEGEND_MARKER}</li>
      </ul>
      <figcaption>
        <TimelineSummary model={model} />
        {recentSummary ? <p className={styles.muted}>{recentSummary}</p> : null}
      </figcaption>
      <details className={styles.tableDetails}>
        <summary>{TIMELINE_TABLE_SUMMARY}</summary>
        <table className={styles.table}>
          <caption className="visually-hidden">{model.yAxisTitle}</caption>
          <thead>
            <tr>
              <th scope="col">{TIMELINE_TABLE_WEEK}</th>
              <th scope="col">{TIMELINE_TABLE_VALUE}</th>
              <th scope="col">{TIMELINE_TABLE_MIN}</th>
              <th scope="col">{TIMELINE_TABLE_MAX}</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((r) => (
              <tr key={r.weekStart}>
                <th scope="row">{r.weekStart}</th>
                <td>{cell(r.wAvg)}</td>
                <td>{cell(r.histMin)}</td>
                <td>{cell(r.histMax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
