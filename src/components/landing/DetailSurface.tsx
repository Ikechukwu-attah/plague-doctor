"use client";
import { useEffect, useRef } from "react";
import type { Pathogen } from "@/evidence/types";
import { CityDetail } from "@/components/city/CityDetail";
import { detailModeForWidth, useDetailMode } from "./detail-mode";
import type { DetailMode } from "./detail-mode";
import styles from "./Landing.module.css";

export { detailModeForWidth, useDetailMode };
export type { DetailMode };

export interface DetailSurfaceProps {
  locationId: string;
  /** Accessible name for the landmark (e.g. the location name). */
  label: string;
  mode: Exclude<DetailMode, "page">;
  virus?: Pathogen;
  onClose: () => void;
}

/** Non-modal landmark: Escape closes, focus moves in on open and returns to the opener on close. */
export function DetailSurface({ locationId, label, mode, virus, onClose }: DetailSurfaceProps) {
  const ref = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const heading = ref.current?.querySelector<HTMLElement>("h1, h2");
    const target = heading ?? ref.current;
    if (heading && heading.tabIndex < 0) heading.tabIndex = -1;
    target?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label={label}
      className={`${styles.surface} ${mode === "drawer" ? styles.drawer : styles.sheet}`}
      data-variant={mode}
    >
      {/* CityDetail renders the single labelled close control. */}
      <CityDetail locationId={locationId} variant={mode} {...(virus ? { virus } : {})} onClose={onClose} />
    </aside>
  );
}
