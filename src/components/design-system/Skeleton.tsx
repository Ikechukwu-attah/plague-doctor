import { LOADING_LABEL } from "@/ui-copy/states";
import styles from "./DesignSystem.module.css";

export interface SkeletonProps {
  variant?: "lines" | "rows" | "card";
  lines?: number;
  rows?: number;
}

/** Placeholder for pending data. Shows no values; shimmer stops under reduced motion. */
export function Skeleton({ variant = "lines", lines = 3, rows = 4 }: SkeletonProps) {
  const count = variant === "rows" ? rows : variant === "card" ? 1 : lines;
  const cls = variant === "rows" ? styles.skeletonRow : variant === "card" ? styles.skeletonCard : styles.skeletonLine;
  return (
    <div className={styles.skeleton} aria-busy="true" data-variant={variant}>
      <span className="visually-hidden">{LOADING_LABEL}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${cls} ${styles.shimmer}`} aria-hidden="true" />
      ))}
    </div>
  );
}
