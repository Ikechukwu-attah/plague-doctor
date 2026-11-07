import type { FreshnessLabel } from "@/evidence/card-types";
import { lanternModel } from "@/lib/view/freshness";
import styles from "./DesignSystem.module.css";

/** Lantern brightness encodes freshness only. Props: the label and nothing else. */
export function FreshnessLantern({ label }: { label: FreshnessLabel }) {
  const m = lanternModel(label);
  const lit = m.brightness === "bright" || m.brightness === "dim";
  const fill = m.brightness === "bright" ? "var(--lantern)" : m.brightness === "dim" ? "var(--lantern-delayed)" : "none";
  // Extinguished and no-data outlines use the hatch stroke (3:1 on ink-700), not --level-unknown (2.5:1).
  const stroke = lit ? fill : "var(--level-unknown-stroke)";
  return (
    <span className={styles.lantern} data-lantern={m.brightness}>
      <svg className={styles.lanternSvg} viewBox="0 0 16 22" aria-hidden="true" focusable="false">
        <path
          d="M8 1v3M4 4h8l2 3v9l-2 3H4l-2-3V7z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeDasharray={m.brightness === "none" ? "2 2" : undefined}
        />
      </svg>
      <span>{m.text}</span>
    </span>
  );
}
