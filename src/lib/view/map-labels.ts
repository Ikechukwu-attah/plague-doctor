/**
 * Map label selection (UI-3.6, UI-3.11, task 17.15). Pure and data-derived: no city names are hardcoded.
 *
 * Runs AFTER clustering, over the rendered items (single markers and cluster markers with pixel centres).
 * Candidates, in order:
 *   1. the selected location, always tried first;
 *   2. then locations with a PHAC city-level observation (observation.grouping === "city") and a level,
 *      by PHAC activityIndex severity (high first), then locationId ascending;
 *   at most MAP_LABEL_CAP labels are placed.
 * A label is placed on the first side (right, left, above, below) whose box lies inside the map box and
 * intersects no obstacle and no already placed label. Obstacles are the 44 px hit box of every rendered single
 * marker and cluster except the label's own marker (which also covers each visible dot). If no side fits the
 * label is dropped, selected location included: its marker, accessible name and list row are unaffected.
 * Locations without a point, "no site" rows and unknown levels never get a label slot.
 */
import type { LandingRow } from "./landing-rows";
import { HIT_SIZE } from "./marker-clusters";
import type { MarkerItem } from "./marker-clusters";

export const MAP_LABEL_CAP = 12;
const SEVERITY: Record<string, number> = { high: 4, moderate: 3, low: 2, not_detected: 1 };
const LABEL_H = 24;
const CHAR_W = 7.5; // conservative for 12 px Inter at weight 500
const PAD_W = 52; // padding + level icon + trend glyph + spacing
const GAP = 4; // distance between the marker's 44 px box and the label (matches --space-1)
const HALF = HIT_SIZE / 2;

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

const SIDES: readonly MapLabelSide[] = ["right", "left", "above", "below"];

/**
 * @param rows all landing rows that may be labelled (looked up by location id for single items)
 * @param items the rendered items from clusterMarkers at `size`
 */
export function selectMapLabels(
  rows: readonly LandingRow[],
  selectedId: string | undefined,
  size: MapBoxSize,
  items: readonly MarkerItem[],
  cap: number = MAP_LABEL_CAP,
): MapLabel[] {
  const byId = new Map(rows.filter((r) => r.point).map((r) => [r.location.locationId, r]));
  const singles = items.filter((i) => i.kind === "marker" && byId.has(i.id));
  const selected = singles.find((i) => i.id === selectedId);
  const rank = (i: MarkerItem) => SEVERITY[byId.get(i.id)!.observation?.activityIndex ?? ""] ?? 0;
  const candidates = singles
    .filter((i) => i !== selected && eligible(byId.get(i.id)!))
    .sort((a, b) => rank(b) - rank(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const order = selected ? [selected, ...candidates] : candidates;
  const obstacles = items.map((i) => ({
    id: i.id,
    box: { x0: i.x - HALF, y0: i.y - HALF, x1: i.x + HALF, y1: i.y + HALF },
  }));
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
      if (placedBoxes.some((o) => hit(o, b))) continue;
      placedBoxes.push(b);
      out.push({ id: item.id, side });
      break;
    }
  }
  return out;
}
