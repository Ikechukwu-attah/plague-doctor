"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { selectMapLabels } from "@/lib/view/map-labels";
import type { Pathogen } from "@/evidence/types";
import type { LandingRow } from "@/lib/view/landing-rows";
import { fogSpec } from "@/lib/view/fog";
import { dodgeMarkers } from "@/lib/view/marker-dodge";
import provinces from "@/data/geo/canada-provinces.projected.json";
import { mapLabel, mapTextAlternative, SKIP_MAP } from "@/ui-copy/landing";
import type { MapCounts } from "@/ui-copy/landing";
import { LOADING_LABEL } from "@/ui-copy/states";
import { FogLayer } from "./FogLayer";
import type { FogItem } from "./FogLayer";
import { MapMarker } from "./MapMarker";
import { MAP_H, MAP_W } from "./map-geometry";
import { CITY_LIST_ID } from "./landing-ids";
import styles from "./Landing.module.css";

export { CITY_LIST_ID };

const OUTLINES = (provinces as { provinces: Array<{ pruid: string; d: string }> }).provinces;
/** Maximum distance (px) between a dodged marker and its true point (UI-20.11). */
export const MAX_DODGE_PX = 40;

export function countRows(rows: LandingRow[]): MapCounts {
  const counts: MapCounts = {
    total: rows.filter((r) => !r.duplicateMarker).length,
    byActivity: { high: 0, moderate: 0, low: 0, not_detected: 0, unknown: 0 },
    noSite: 0,
  };
  for (const r of rows) {
    if (r.duplicateMarker) continue;
    if (r.noSite) counts.noSite += 1;
    else counts.byActivity[r.badge.kind === "level" ? r.badge.activity : "unknown"] += 1;
  }
  return counts;
}

export function SkipMapLink() {
  return (
    <a href={`#${CITY_LIST_ID}`} className={styles.skipMap}>
      {SKIP_MAP}
    </a>
  );
}

export interface CanadaMapProps {
  rows: LandingRow[];
  virus: Pathogen;
  /** Sample week (EpiWeek Sunday) shown in the label and text alternative. */
  week?: string;
  selectedId?: string;
  /** Draw markers and fog for places without data or monitoring site (UI-19.18). Default off. */
  showNoData?: boolean;
  /**
   * Task 17.14: data has not arrived yet. Draws the province outlines only (no markers, no counts, no fog) so the
   * panel is never blank once the chunk is ready; the text alternative says "Loading" instead of any count.
   */
  pending?: boolean;
  onOpen: (locationId: string) => void;
}

/** A place the map draws by default: it has a monitoring site and a PHAC level. */
export function hasMapData(r: LandingRow): boolean {
  return !r.noSite && r.badge.kind === "level";
}

/**
 * Decorative outlines + absolutely positioned markers (left = x/w, top = y/h). Ordered west to east.
 * Every visible marker is drawn (no clusters); overlapping hit boxes are separated by the Marker_Dodge and a thin
 * leader line joins each displaced marker to its true point (UI-20.8 to UI-20.13). Fog stays at the true points.
 */
export function CanadaMap({ rows, virus, week, selectedId, showNoData = false, pending = false, onOpen }: CanadaMapProps) {
  // Markers, fog, dodge and labels all work from this visible set; the text alternative counts every row.
  const placed = rows
    .filter((r) => r.point && !r.duplicateMarker && (showNoData || hasMapData(r)))
    .sort((a, b) => a.point!.x - b.point!.x || a.location.locationId.localeCompare(b.location.locationId));
  const fog: FogItem[] = placed.map((r) => ({
    id: r.location.locationId,
    spec: fogSpec(r.noSite ? "unknown" : (r.observation?.activityIndex ?? "unknown")),
    left: (r.point!.x / MAP_W) * 100,
    top: (r.point!.y / MAP_H) * 100,
  }));
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 640, height: (640 * MAP_H) / MAP_W });
  const [measured, setMeasured] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setSize((s) => (s.width === w && s.height === h ? s : { width: w, height: h }));
        setMeasured(true);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The dodge needs the real rendered size; before the first measurement markers sit at their true points.
  const dodged = useMemo(
    () =>
      measured
        ? dodgeMarkers(
            placed.map((r) => ({
              id: r.location.locationId,
              x: (r.point!.x / MAP_W) * size.width,
              y: (r.point!.y / MAP_H) * size.height,
            })),
            { hit: 24, maxDisplacement: MAX_DODGE_PX, bounds: size },
          ).markers
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, size, measured, showNoData],
  );
  const dodgeById = new Map((dodged ?? []).map((m) => [m.id, m]));
  // Labels run over the dodged positions and leader lines; before the first measurement none are drawn.
  const labels = useMemo(
    () => new Map(dodged ? selectMapLabels(placed, selectedId, size, dodged).map((l) => [l.id, l.side]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dodged, rows, selectedId, size, showNoData],
  );
  const labelArgs = week ? { virus, week } : { virus };
  return (
    <div className={styles.mapWrap} data-map-panel="" {...(pending ? { "aria-busy": true } : {})}>
      {pending ? null : <SkipMapLink />}
      <div
        ref={boxRef}
        role="group"
        aria-label={pending ? LOADING_LABEL : mapLabel(labelArgs)}
        className={styles.mapBox}
        data-map=""
      >
        <p className="visually-hidden">
          {pending ? LOADING_LABEL : mapTextAlternative({ ...labelArgs, counts: countRows(rows) })}
        </p>
        <svg
          className={styles.outlines}
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {OUTLINES.map((p) => (
            <path key={p.pruid} d={p.d} className={styles.province} />
          ))}
        </svg>
        <FogLayer items={fog} />
        {dodged && dodged.some((m) => m.displaced) ? (
          <svg
            className={styles.leaders}
            viewBox={`0 0 ${size.width} ${size.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
            data-leaders=""
          >
            {dodged
              .filter((m) => m.displaced)
              .map((m) => (
                <g key={m.id} data-leader={m.id}>
                  <line x1={m.x} y1={m.y} x2={m.trueX} y2={m.trueY} className={styles.leaderLine} />
                  <circle cx={m.trueX} cy={m.trueY} r={2} className={styles.leaderAnchor} />
                </g>
              ))}
          </svg>
        ) : null}
        {placed.map((r) => {
          const id = r.location.locationId;
          const m = dodgeById.get(id);
          return (
            <MapMarker
              key={id}
              row={r}
              selected={id === selectedId}
              labelSide={labels.get(id)}
              display={m ? { left: `${(m.x / size.width) * 100}%`, top: `${(m.y / size.height) * 100}%` } : undefined}
              onOpen={onOpen}
            />
          );
        })}
      </div>
    </div>
  );
}
