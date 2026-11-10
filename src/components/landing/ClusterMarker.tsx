"use client";
import { markerPosition, MAP_H, MAP_W } from "./MapMarker";
import { clusterLabel } from "@/ui-copy/landing";
import styles from "./Landing.module.css";

/** One 44 px button standing for several overlapping places. */
export function ClusterMarker(props: {
  id: string;
  fx: number;
  fy: number;
  count: number;
  hasSelected: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const pos = markerPosition({ x: props.fx * MAP_W, y: props.fy * MAP_H });
  return (
    <button
      type="button"
      className={[styles.marker, styles.clusterMarker, props.hasSelected ? styles.selected : ""].filter(Boolean).join(" ")}
      style={pos}
      aria-label={clusterLabel({ count: props.count, selected: props.hasSelected })}
      aria-haspopup="dialog"
      aria-expanded={props.open}
      data-cluster-id={props.id}
      onClick={props.onToggle}
    >
      <span className={`mono ${styles.clusterBadge}`} aria-hidden="true">
        {props.count}
      </span>
    </button>
  );
}
