import type { Direction } from "@/evidence/types";
import { trendGlyphModel } from "@/lib/view/trend";
import styles from "./DesignSystem.module.css";

/** PHAC trend: glyph + word, always both. */
export function TrendGlyph({ trend }: { trend: Direction }) {
  const m = trendGlyphModel(trend);
  return (
    <span className={styles.trend} data-trend={trend}>
      <span className={styles.trendGlyph} aria-hidden="true">
        {m.glyph}
      </span>
      <span>{m.word}</span>
    </span>
  );
}
