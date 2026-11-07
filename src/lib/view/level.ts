/** Level badge view model (UI-1.4, UI-1.5). Verbatim PHAC activity; unknown is never a level. */
import type { Activity, UnknownReason } from "@/evidence/types";
import { levelLabel } from "@/ui-copy/levels";

type KnownActivity = Exclude<Activity, "unknown">;

export type LevelBadgeModel =
  | {
      kind: "level";
      activity: KnownActivity;
      icon: "▲▲" | "▲" | "▽" | "○";
      word: "High" | "Moderate" | "Low" | "Not detected";
      cssVar: string;
    }
  | { kind: "unknown"; icon: "hatch"; word: "No data"; reason?: UnknownReason };

const ICON: Record<KnownActivity, "▲▲" | "▲" | "▽" | "○"> = {
  high: "▲▲",
  moderate: "▲",
  low: "▽",
  not_detected: "○",
};

const CSS_VAR: Record<KnownActivity, string> = {
  high: "var(--level-high)",
  moderate: "var(--level-moderate)",
  low: "var(--level-low)",
  not_detected: "var(--level-nd)",
};

export function levelBadgeModel(activity: Activity, reason?: UnknownReason): LevelBadgeModel {
  if (activity === "unknown") {
    return reason === undefined
      ? { kind: "unknown", icon: "hatch", word: "No data" }
      : { kind: "unknown", icon: "hatch", word: "No data", reason };
  }
  return {
    kind: "level",
    activity,
    icon: ICON[activity],
    word: levelLabel(activity) as "High" | "Moderate" | "Low" | "Not detected",
    cssVar: CSS_VAR[activity],
  };
}
