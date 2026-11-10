"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { selectMapLabels } from "@/lib/view/map-labels";
import type { Pathogen } from "@/evidence/types";
import type { LandingRow } from "@/lib/view/landing-rows";
import { fogSpec } from "@/lib/view/fog";
import provinces from "@/data/geo/canada-provinces.projected.json";
import { mapLabel, mapTextAlternative, SKIP_MAP } from "@/ui-copy/landing";
import type { MapCounts } from "@/ui-copy/landing";
import { LOADING_LABEL } from "@/ui-copy/states";
import { FogLayer } from "./FogLayer";
import type { FogItem } from "./FogLayer";
import { MapMarker, MAP_H, MAP_W } from "./MapMarker";
import { ClusterMarker } from "./ClusterMarker";
import { ClusterChooser } from "./ClusterChooser";
import { clusterMarkers } from "@/lib/view/marker-clusters";
import { CITY_LIST_ID } from "./landing-ids";
import styles from "./Landing.module.css";

export { CITY_LIST_ID };

const OUTLINES = (provinces as { provinces: Array<{ pruid: string; d: string }> }).provinces;

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

/** Decorative outlines + absolutely positioned markers (left = x/w, top = y/h). Ordered west to east. */
export function CanadaMap({ rows, virus, week, selectedId, showNoData = false, pending = false, onOpen }: CanadaMapProps) {
  // Markers, fog, clustering and labels all work from this visible set; the text alternative counts every row.
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
  const [size, setSize] = useState({ width: 640, height: 545 });
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
  // Clustering needs the real rendered size; before the first measurement every marker is rendered.
  const items = useMemo(
    () =>
      measured
        ? clusterMarkers(
            placed.map((r) => ({ id: r.location.locationId, fx: r.point!.x / MAP_W, fy: r.point!.y / MAP_H })),
            size,
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, size, measured, showNoData],
  );
  const byId = new Map(placed.map((r) => [r.location.locationId, r]));
  // Labels run after clustering over the rendered items; before the first measurement none are drawn.
  const labels = useMemo(
    () => new Map(items ? selectMapLabels(placed, selectedId, size, items).map((l) => [l.id, l.side]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, rows, selectedId, size, showNoData],
  );
  const [openCluster, setOpenCluster] = useState<string | null>(null);
  const open = items?.find((i) => i.kind === "cluster" && i.id === openCluster) ?? null;
  function closeChooser(returnFocus: boolean) {
    const id = openCluster;
    setOpenCluster(null);
    if (returnFocus && id) {
      requestAnimationFrame(() => {
        boxRef.current?.querySelector<HTMLElement>(`[data-cluster-id="${CSS.escape(id)}"]`)?.focus();
      });
    }
  }
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
        {items
          ? items.map((i) =>
              i.kind === "marker" ? (
                <MapMarker key={i.id} row={byId.get(i.id)!} selected={i.id === selectedId} labelSide={labels.get(i.id)} onOpen={onOpen} />
              ) : (
                <ClusterMarker
                  key={i.id}
                  id={i.id}
                  fx={i.fx}
                  fy={i.fy}
                  count={i.memberIds.length}
                  hasSelected={selectedId !== undefined && i.memberIds.includes(selectedId)}
                  open={open?.id === i.id}
                  onToggle={() => setOpenCluster((c) => (c === i.id ? null : i.id))}
                />
              ),
            )
          : placed.map((r) => (
              <MapMarker key={r.location.locationId} row={r} selected={r.location.locationId === selectedId} labelSide={labels.get(r.location.locationId)} onOpen={onOpen} />
            ))}
      </div>
      {open ? (
        <ClusterChooser
          rows={open.memberIds.map((id) => byId.get(id)!)}
          selectedId={selectedId}
          onOpen={(id) => {
            setOpenCluster(null);
            onOpen(id);
          }}
          onClose={closeChooser}
        />
      ) : null}
    </div>
  );
}
