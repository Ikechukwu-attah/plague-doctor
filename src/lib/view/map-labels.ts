/**
 * Map label selection (UI-3.6, UI-3.11, UI-19.39, UI-20.16, UI-20.17). Pure and data-derived: no city names are hardcoded.
 *
 * Runs over the dodged marker positions (see marker-dodge.ts), in pixels at the current map size.
 * Candidates, in order:
 *   1. the selected location, always tried first;
 *   2. then locations with a PHAC city-level observation (observation.grouping === "city") and a level,
 *      by PHAC activityIndex severity (high first), then locationId ascending;
 *   at most MAP_LABEL_CAP labels are placed. The hovered marker's name is shown by CSS (:hover) so that hovering
 *   never re-flows the placed labels; it may overlay temporarily.
 * A label is placed on the first side (right, left, above, below) whose box lies inside the map box and
 * intersects no obstacle and no already placed label. Obstacles are the 24 px hit box of every marker except the
 * label's own marker (which also covers each visible dot), and every leader line (its bounding box, which includes
 * the anchor dot at the true point). If no side fits the label is dropped, selected location included: its marker,
 * accessible name and list row are unaffected.
 * Locations without a point, "no site" rows and unknown levels never get a label slot.
 */
import type { LandingRow } from "./landing-rows";
import { HIT_MIN, LEADER_MIN_PX } from "./marker-dodge";
import type { DodgedMarker } from "./marker-dodge";

export const MAP_LABEL_CAP = 12;
const SEVERITY: Record<string, number> = { high: 4, moderate: 3, low: 2, not_detected: 1 };
const LABEL_H = 24;
const CHAR_W = 7.5; // conservative for 12 px Inter at weight 500
const PAD_W = 52; // padding + level icon + trend glyph + spacing
const GAP = 4; // distance between the marker's hit box and the label (matches --space-1)
const HALF = HIT_MIN / 2;
/** Half thickness given to a leader line's box (1 px stroke plus the 3 px anchor dot radius). */
const LEADER_PAD = 3;

export type MapLabelSide = "right" | "left" | "above" | "below";

export interface MapLabel {
  id: string;
  side: MapLabelSide;
}

export interface MapBoxSize {
  width: number;
  height: number;
}

/** Visible label text: marker name + level word, never colour alone. */
export function labelText(row: LandingRow): string {
  const word = row.noSite ? "No site" : row.badge.word;
  return word ? `${row.location.locationName} · ${word}` : row.location.locationName;
}

export interface LabelRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function hit(a: LabelRect, b: LabelRect): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

function eligible(r: LandingRow): boolean {
  if (!r.point || r.noSite || r.stopped || !r.observation) return false;
  return r.observation.grouping === "city" && r.badge.kind === "level";
}

/** Box a label would occupy on a side of a marker centred at (x, y). Mirrors the CSS in Landing.module.css. */
export function labelBox(side: MapLabelSide, x: number, y: number, w: number): LabelRect {
  switch (side) {
    case "right":
      return { x0: x + HALF + GAP, y0: y - LABEL_H / 2, x1: x + HALF + GAP + w, y1: y + LABEL_H / 2 };
    case "left":
      return { x0: x - HALF - GAP - w, y0: y - LABEL_H / 2, x1: x - HALF - GAP, y1: y + LABEL_H / 2 };
    case "above":
      return { x0: x - w / 2, y0: y - HALF - GAP - LABEL_H, x1: x + w / 2, y1: y - HALF - GAP };
    case "below":
      return { x0: x - w / 2, y0: y + HALF + GAP, x1: x + w / 2, y1: y + HALF + GAP + LABEL_H };
  }
}

/** Bounding box of a marker's 24 px hit box. */
export function markerBox(m: { x: number; y: number }): LabelRect {
  return { x0: m.x - HALF, y0: m.y - HALF, x1: m.x + HALF, y1: m.y + HALF };
}

/** Bounding box of the leader line (display point to true point, plus the anchor dot); null when not displaced. */
export function leaderBox(m: Pick<DodgedMarker, "x" | "y" | "trueX" | "trueY">): LabelRect | null {
  if (Math.hypot(m.x - m.trueX, m.y - m.trueY) < LEADER_MIN_PX) return null;
  return {
    x0: Math.min(m.x, m.trueX) - LEADER_PAD,
    y0: Math.min(m.y, m.trueY) - LEADER_PAD,
    x1: Math.max(m.x, m.trueX) + LEADER_PAD,
    y1: Math.max(m.y, m.trueY) + LEADER_PAD,
  };
}

const SIDES: readonly MapLabelSide[] = ["right", "left", "above", "below"];

/**
 * @param rows all landing rows that may be labelled (looked up by location id)
 * @param markers dodged marker positions in px at `size` (one per rendered marker)
 */
export function selectMapLabels(
  rows: readonly LandingRow[],
  selectedId: string | undefined,
  size: MapBoxSize,
  markers: readonly Pick<DodgedMarker, "id" | "x" | "y" | "trueX" | "trueY">[],
  cap: number = MAP_LABEL_CAP,
): MapLabel[] {
  const byId = new Map(rows.filter((r) => r.point).map((r) => [r.location.locationId, r]));
  const singles = markers.filter((i) => byId.has(i.id));
  const selected = singles.find((i) => i.id === selectedId);
  const rank = (i: { id: string }) => SEVERITY[byId.get(i.id)!.observation?.activityIndex ?? ""] ?? 0;
  const candidates = singles
    .filter((i) => i !== selected && eligible(byId.get(i.id)!))
    .sort((a, b) => rank(b) - rank(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const order = selected ? [selected, ...candidates] : candidates;
  const obstacles = markers.map((i) => ({ id: i.id, box: markerBox(i) }));
  const leaders = markers.flatMap((i) => {
    const b = leaderBox(i);
    return b ? [b] : [];
  });
  const out: MapLabel[] = [];
  const placedBoxes: LabelRect[] = [];
  for (const item of order) {
    if (out.length >= cap) break;
    const w = labelText(byId.get(item.id)!).length * CHAR_W + PAD_W;
    for (const side of SIDES) {
      const b = labelBox(side, item.x, item.y, w);
      const inside = b.x0 >= 0 && b.x1 <= size.width && b.y0 >= 0 && b.y1 <= size.height;
      if (!inside) continue;
      if (obstacles.some((o) => o.id !== item.id && hit(o.box, b))) continue;
      if (leaders.some((l) => hit(l, b))) continue;
      if (placedBoxes.some((o) => hit(o, b))) continue;
      placedBoxes.push(b);
      out.push({ id: item.id, side });
      break;
    }
  }
  return out;
}
