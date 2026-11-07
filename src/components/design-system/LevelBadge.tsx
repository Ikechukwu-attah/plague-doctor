import type { CSSProperties } from "react";
import type { Activity, UnknownReason } from "@/evidence/types";
import { levelBadgeModel } from "@/lib/view/level";
import { unknownReason } from "@/ui-copy/unknown-reasons";
import styles from "./DesignSystem.module.css";

export interface LevelBadgeProps {
  activity: Activity;
  reason?: UnknownReason;
  size?: "sm" | "md";
}

/** PHAC level: icon + word (+ hatch for unknown). Colour is never the only signal. */
export function LevelBadge({ activity, reason, size = "sm" }: LevelBadgeProps) {
  const model = levelBadgeModel(activity, reason);
  const cls = size === "md" ? `${styles.badge} ${styles.badgeMd}` : styles.badge;
  if (model.kind === "unknown") {
    return (
      <span className={cls} data-activity="unknown" data-reason={model.reason}>
        <span className={styles.hatch} aria-hidden="true" />
        <span>{model.word}</span>
        {model.reason ? <span className="visually-hidden">{unknownReason(model.reason)}</span> : null}
      </span>
    );
  }
  const style = { "--level-color": model.cssVar } as CSSProperties;
  return (
    <span className={cls} data-activity={model.activity} style={style}>
      <span className={styles.icon} aria-hidden="true">
        {model.icon}
      </span>
      <span>{model.word}</span>
    </span>
  );
}
