/** Fog view model (UI-3.4, UI-3.5, UI-3.7, C7). Depends ONLY on PHAC activityIndex. */
import type { Activity } from "@/evidence/types";

export type FogSpec =
  | { kind: "fog"; density: 1 | 2 | 3 | 4; radiusPx: number; peakOpacity: number } // 1=not_detected … 4=high
  | { kind: "hatch"; radiusPx: number }; // unknown: hatched halo, no teal fog

const FOG: Record<Exclude<Activity, "unknown">, Extract<FogSpec, { kind: "fog" }>> = {
  not_detected: { kind: "fog", density: 1, radiusPx: 40, peakOpacity: 0.18 },
  low: { kind: "fog", density: 2, radiusPx: 76, peakOpacity: 0.3 },
  moderate: { kind: "fog", density: 3, radiusPx: 124, peakOpacity: 0.42 },
  high: { kind: "fog", density: 4, radiusPx: 180, peakOpacity: 0.55 },
};

const HATCH: FogSpec = { kind: "hatch", radiusPx: 28 };

export function fogSpec(activityIndex: Activity): FogSpec {
  return activityIndex === "unknown" ? { ...HATCH } : { ...FOG[activityIndex] };
}
