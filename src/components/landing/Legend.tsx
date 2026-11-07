import type { Activity } from "@/evidence/types";
import { LevelBadge } from "@/components/design-system/LevelBadge";
import { LEGEND_LABEL, LEGEND_SENTENCE } from "@/ui-copy/landing";
import styles from "./Landing.module.css";

const VARIANTS: readonly Activity[] = ["high", "moderate", "low", "not_detected", "unknown"];

/** All five badge variants, including hatched "No data". */
export function Legend() {
  return (
    <ul className={styles.legend} aria-label={LEGEND_LABEL}>
      {VARIANTS.map((a) => (
        <li key={a}>
          <LevelBadge activity={a} />
        </li>
      ))}
      <li>{LEGEND_SENTENCE}</li>
    </ul>
  );
}
