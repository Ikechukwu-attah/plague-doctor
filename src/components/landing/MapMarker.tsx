"use client";
import type { CSSProperties } from "react";
import type { LandingRow } from "@/lib/view/landing-rows";
import { trendGlyphModel } from "@/lib/view/trend";
import type { MapLabelSide } from "@/lib/view/map-labels";
import { SELECTED } from "@/ui-copy/landing";
import styles from "./Landing.module.css";

export const MAP_W = 1000;
export const MAP_H = 851;

export function markerPosition(p: { x: number; y: number }): { left: string; top: string } {
  return { left: `${(p.x / MAP_W) * 100}%`, top: `${(p.y / MAP_H) * 100}%` };
}

/** Shape + glyph + word; colour is never the only signal. */
export function MapMarker(props: { row: LandingRow; selected?: boolean; labelSide?: MapLabelSide | undefined; onOpen: (locationId: string) => void }) {
  const { row, selected } = props;
  if (!row.point) return null;
  const pos = markerPosition(row.point);
  const b = row.badge;
  const unknown = b.kind === "unknown";
  const dotCls = unknown
    ? `${styles.dot} ${styles.dotHatch}`
    : b.activity === "not_detected"
      ? `${styles.dot} ${styles.dotNd}`
      : styles.dot;
  const side = props.labelSide;
  const labelCls = [
    styles.markerLabel,
    side ? styles.labelOn : "",
    side === "left" ? styles.labelLeft : "",
    side === "above" ? styles.labelAbove : "",
    side === "below" ? styles.labelBelow : "",
  ]
    .filter(Boolean)
    .join(" ");
  const style = { ...pos, ...(b.kind === "level" ? { "--level-color": b.cssVar } : {}) } as CSSProperties;
  const word = row.noSite ? null : b.word;
  const glyph = !unknown && row.trend !== "unknown" ? trendGlyphModel(row.trend).glyph : null;
  const name = selected ? `${row.markerLabel}, ${SELECTED}` : row.markerLabel;
  return (
    <button
      type="button"
      className={[styles.marker, selected ? styles.selected : "", props.labelSide ? styles.markerLabelled : ""]
        .filter(Boolean)
        .join(" ")}
      style={style}
      aria-label={name}
      aria-current={selected ? "true" : undefined}
      data-location-id={row.location.locationId}
      onClick={() => props.onOpen(row.location.locationId)}
    >
      <span className={dotCls} aria-hidden="true" />
      <span className={labelCls} aria-hidden="true" data-label={props.labelSide}>
        {b.kind === "level" ? <span className={styles.markerIcon}>{b.icon}</span> : null}
        {row.location.locationName}
        {word ? ` · ${word}` : ""}
        {glyph ? ` ${glyph}` : ""}
      </span>
    </button>
  );
}
