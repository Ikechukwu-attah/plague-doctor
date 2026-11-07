"use client";
import type { Pathogen } from "@/evidence/types";
import type { LandingRow } from "@/lib/view/landing-rows";
import { fogSpec } from "@/lib/view/fog";
import provinces from "@/data/geo/canada-provinces.projected.json";
import { mapLabel, mapTextAlternative, SKIP_MAP } from "@/ui-copy/landing";
import type { MapCounts } from "@/ui-copy/landing";
import { FogLayer } from "./FogLayer";
import type { FogItem } from "./FogLayer";
import { MapMarker, MAP_H, MAP_W } from "./MapMarker";
import styles from "./Landing.module.css";

export const CITY_LIST_ID = "city-list";

const OUTLINES = (provinces as { provinces: Array<{ pruid: string; d: string }> }).provinces;

export function countRows(rows: LandingRow[]): MapCounts {
  const counts: MapCounts = {
    total: rows.length,
    byActivity: { high: 0, moderate: 0, low: 0, not_detected: 0, unknown: 0 },
    noSite: 0,
  };
  for (const r of rows) {
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
  onOpen: (locationId: string) => void;
}

/** Decorative outlines + absolutely positioned markers (left = x/w, top = y/h). Ordered west to east. */
export function CanadaMap({ rows, virus, week, selectedId, onOpen }: CanadaMapProps) {
  const placed = rows
    .filter((r) => r.point)
    .sort((a, b) => a.point!.x - b.point!.x || a.location.locationId.localeCompare(b.location.locationId));
  const fog: FogItem[] = placed.map((r) => ({
    id: r.location.locationId,
    spec: fogSpec(r.noSite ? "unknown" : (r.observation?.activityIndex ?? "unknown")),
    left: (r.point!.x / MAP_W) * 100,
    top: (r.point!.y / MAP_H) * 100,
  }));
  const labelArgs = week ? { virus, week } : { virus };
  return (
    <div className={styles.mapWrap}>
      <SkipMapLink />
      <div role="group" aria-label={mapLabel(labelArgs)} className={styles.mapBox} data-map="">
        <p className="visually-hidden">{mapTextAlternative({ ...labelArgs, counts: countRows(rows) })}</p>
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
        {placed.map((r) => (
          <MapMarker key={r.location.locationId} row={r} selected={r.location.locationId === selectedId} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
