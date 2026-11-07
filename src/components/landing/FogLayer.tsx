import type { CSSProperties } from "react";
import type { FogSpec } from "@/lib/view/fog";
import styles from "./Landing.module.css";

export interface FogItem {
  id: string;
  spec: FogSpec;
  /** Percent of map width / height. */
  left: number;
  top: number;
}

/** Deterministic drift timing from the marker index: 12-20 s, staggered start. */
export function driftTiming(index: number): { duration: number; delay: number } {
  return { duration: 12 + ((index * 5) % 9), delay: -((index * 3) % 11) };
}

/** Fog depends only on the PHAC activity index (via FogSpec). Unknown is a hatched ring, never "no fog". */
export function FogLayer({ items }: { items: FogItem[] }) {
  return (
    <div className={styles.fogLayer} aria-hidden="true" data-fog-layer="">
      {items.map((it, i) => {
        const t = driftTiming(i);
        const size = it.spec.radiusPx;
        const outer: CSSProperties = { left: `${it.left}%`, top: `${it.top}%`, width: size, height: size };
        const inner = {
          "--drift-duration": `${t.duration}s`,
          "--drift-delay": `${t.delay}s`,
          ...(it.spec.kind === "fog" ? { "--peak": it.spec.peakOpacity } : {}),
        } as CSSProperties;
        return (
          <span
            key={it.id}
            className={styles.fogSpot}
            style={outer}
            data-fog={it.spec.kind === "fog" ? it.spec.density : "hatch"}
          >
            <span
              className={
                it.spec.kind === "hatch" ? `${styles.fogDrift} ${styles.fogHatch}` : `${styles.fogDrift} fog-drift`
              }
              style={inner}
            />
          </span>
        );
      })}
    </div>
  );
}
