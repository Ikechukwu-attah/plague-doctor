import type { CSSProperties } from "react";
import { LOADING_LABEL } from "@/ui-copy/states";
import styles from "./LanternSkeleton.module.css";

export interface LanternSkeletonProps {
  variant?: "lines" | "rows" | "card" | "map";
  lines?: number;
  rows?: number;
  /** map variant: width / height ratio, used when no height is given. */
  aspect?: number;
  /** map variant: reserved height in px (min-height). */
  height?: number;
}

/** Decorative lantern; never carries information. */
function LanternGlyph() {
  return (
    <svg className={styles.glyph} viewBox="0 0 28 36" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 4h6M14 1v3" />
      <path d="M9 7h10l3 5v12l-3 4H9l-3-4V12z" />
      <path d="M8 31h12M12 34h4" />
      <ellipse cx="14" cy="18" rx="3" ry="4.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Loading placeholder: a faint lantern over drifting fog. Shows no values. Motion is transform/opacity only. */
export function LanternSkeleton({ variant = "lines", lines = 3, rows = 4, aspect = 1.6, height }: LanternSkeletonProps) {
  const count = variant === "rows" ? rows : variant === "lines" ? lines : 1;
  const cls = styles[variant === "rows" ? "row" : variant === "lines" ? "line" : variant];
  const mapStyle: CSSProperties | undefined =
    variant === "map" ? (height ? { minHeight: height, height } : { aspectRatio: String(aspect) }) : undefined;
  return (
    <div className={styles.skeleton} aria-busy="true" data-variant={variant}>
      <span className="visually-hidden">{LOADING_LABEL}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${styles.block} ${cls}`} style={mapStyle} aria-hidden="true">
          <span className={styles.fog} />
          {variant !== "lines" && <span className={`${styles.fog} ${styles.fogSlow}`} />}
          {variant !== "lines" && (i === 0 || variant !== "rows") && <LanternGlyph />}
        </div>
      ))}
    </div>
  );
}
