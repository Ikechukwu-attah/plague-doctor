"use client";
import { useEffect, useRef } from "react";
import type { Pathogen } from "@/evidence/types";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { CityDetail } from "@/components/city/CityDetail";
import { CLOSE_DETAILS } from "@/ui-copy/landing";
import styles from "./Landing.module.css";

export type DetailMode = "drawer" | "sheet" | "page";

/** UI-5.9: 400 px drawer at 1024 px and up, bottom sheet 640-1023, navigation below 640. */
export function detailModeForWidth(width: number): DetailMode {
  return width >= 1024 ? "drawer" : width >= 640 ? "sheet" : "page";
}

/** "page" means the opener should navigate to /city/{id} instead of rendering a surface. */
export function useDetailMode(): DetailMode {
  const wide = useMediaQuery("(min-width: 1024px)");
  const medium = useMediaQuery("(min-width: 640px)");
  return wide ? "drawer" : medium ? "sheet" : "page";
}

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
      <div className={styles.surfaceHead}>
        <button type="button" className={styles.close} aria-label={CLOSE_DETAILS} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>
      <CityDetail locationId={locationId} variant={mode} {...(virus ? { virus } : {})} onClose={onClose} />
    </aside>
  );
}
