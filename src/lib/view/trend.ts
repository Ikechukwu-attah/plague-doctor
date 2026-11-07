/** Trend glyph view model (UI-1.6). PHAC latestTrend, never recomputed. */
import type { Direction } from "@/evidence/types";
import { trendLabel } from "@/ui-copy/levels";

export interface TrendGlyphModel {
  glyph: "↗" | "→" | "↘" | "?";
  word: "Increasing" | "Stable" | "Decreasing" | "Unknown";
}

const GLYPH: Record<Direction, TrendGlyphModel["glyph"]> = {
  increasing: "↗",
  stable: "→",
  decreasing: "↘",
  unknown: "?",
};

export function trendGlyphModel(trend: Direction): TrendGlyphModel {
  return { glyph: GLYPH[trend], word: trendLabel(trend) as TrendGlyphModel["word"] };
}
