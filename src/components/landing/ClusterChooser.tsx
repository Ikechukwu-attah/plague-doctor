"use client";
import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { LandingRow } from "@/lib/view/landing-rows";
import { CLUSTER_CLOSE, CLUSTER_HINT, clusterChooserLabel } from "@/ui-copy/landing";
import { CityRow } from "./CityList";
import styles from "./Landing.module.css";

export interface ClusterChooserProps {
  rows: LandingRow[];
  selectedId?: string | undefined;
  onOpen: (locationId: string) => void;
  /** `returnFocus` is true when the chooser closes without choosing a place. */
  onClose: (returnFocus: boolean) => void;
}

/** Small chooser for markers that overlap at the current map size; rows are the same CityRow as the list. */
export function ClusterChooser({ rows, selectedId, onOpen, onClose }: ClusterChooserProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, []);
  useEffect(() => {
    function away(e: PointerEvent) {
      const t = e.target as Element | null;
      if (ref.current && t && !ref.current.contains(t) && !t.closest("[data-cluster-id]")) onClose(false);
    }
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [onClose]);
  function key(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose(true);
    }
  }
  return (
    <div ref={ref} role="dialog" aria-label={clusterChooserLabel({ count: rows.length })} className={styles.clusterChooser} onKeyDown={key}>
      <p className={styles.clusterHint}>{CLUSTER_HINT}</p>
      <ul className={styles.rows}>
        {rows.map((r) => (
          <CityRow key={r.location.locationId} row={r} selected={r.location.locationId === selectedId} onOpen={onOpen} />
        ))}
      </ul>
      <button type="button" className={styles.clusterClose} onClick={() => onClose(true)}>
        {CLUSTER_CLOSE}
      </button>
    </div>
  );
}
