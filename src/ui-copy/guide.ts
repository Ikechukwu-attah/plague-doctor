/**
 * Guide quotes (UI-1.10): fixed one-sentence templates. No health claims about a date.
 */
import { weekOf } from "./timing";

export type GuideQuoteKind = "landing" | "stale" | "tooEarly" | "unknown" | "card";

export function guideQuote(kind: GuideQuoteKind, s: { week?: string } = {}): string {
  switch (kind) {
    case "landing":
      return "The water records what was there, week by week, and I read it aloud without embellishment.";
    case "stale":
      return s.week
        ? `My latest verified reading is from the ${weekOf(s.week)}.`
        : "My latest verified reading is older than I would like.";
    case "tooEarly":
      return "I read the past in the water and cannot read your date.";
    case "unknown":
      return "Where the water is silent, I say so and leave the gap empty.";
    case "card":
      return "Here is what the latest readings can say, and what they cannot.";
  }
}

export const GUIDE_NAME = "The Plague Doctor";
