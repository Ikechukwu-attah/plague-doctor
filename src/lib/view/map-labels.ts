/**
 * Map label selection (UI-3.6, UI-3.11). Pure and data-derived: no city names are hardcoded.
 *
 * city-points.json carries no population, so the rule follows what design/Main.dc.html shows
 * (a mock labelling its twelve city markers with "Name · Level"): label
 *   1. the selected location, always;
 *   2. then up to MAP_LABEL_CAP - 1 further locations that have a PHAC city-level observation
 *      (observation.grouping === "city") and a level, taken in a deterministic order:
 *      PHAC activityIndex severity (high first), then locationId ascending;
 * skipping any candidate whose label box would overlap an already placed label or the dot of
 * another label-eligible marker.
 * Labels that would overflow the right edge flip to the left of the marker.
 * Locations without a point, "no site" rows and unknown levels never get a label slot
 * (the accessible name on every marker is unaffected; labels are visual only).
 */
import type { LandingRow } from "./landing-rows";

export const MAP_LABEL_CAP = 12;
const SEVERITY: Record<string, number> = { high: 4, moderate: 3, low: 2, not_detected: 1 };
const DOT_GAP = 14; // dot radius + margin
const LABEL_H = 24;
const CHAR_W = 7;
const PAD_W = 48; // padding + level icon + trend glyph

export interface MapLabel {
  id: string;
  side: "right" | "left";
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

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function hit(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

function eligible(r: LandingRow): boolean {
  if (!r.point || r.noSite || r.stopped || !r.observation) return false;
  return r.observation.grouping === "city" && r.badge.kind === "level";
}

export function selectMapLabels(
  rows: readonly LandingRow[],
  selectedId: string | undefined,
  size: MapBoxSize,
  mapW: number,
  mapH: number,
  cap: number = MAP_LABEL_CAP,
): MapLabel[] {
  const placed = rows.filter((r) => r.point);
  const px = (r: LandingRow) => ({ x: (r.point!.x / mapW) * size.width, y: (r.point!.y / mapH) * size.height });
  const dots: Rect[] = placed.map((r) => {
    const p = px(r);
    return { x0: p.x - 8, y0: p.y - 8, x1: p.x + 8, y1: p.y + 8 };
  });
  const selected = placed.find((r) => r.location.locationId === selectedId);
  const candidates = placed
    .filter((r) => r !== selected && eligible(r))
    .sort((a, b) => {
      const sa = SEVERITY[a.observation!.activityIndex] ?? 0;
      const sb = SEVERITY[b.observation!.activityIndex] ?? 0;
      return sb - sa || (a.location.locationId < b.location.locationId ? -1 : a.location.locationId > b.location.locationId ? 1 : 0);
    });
  const order = selected ? [selected, ...candidates] : candidates;
  const labelled = new Set(order.slice(0, cap).map((r) => r.location.locationId));
  const out: MapLabel[] = [];
  const boxes: Rect[] = [];
  for (const r of order) {
    if (out.length >= cap) break;
    const p = px(r);
    const w = labelText(r).length * CHAR_W + PAD_W;
    const right: Rect = { x0: p.x + DOT_GAP, y0: p.y - LABEL_H / 2, x1: p.x + DOT_GAP + w, y1: p.y + LABEL_H / 2 };
    const left: Rect = { x0: p.x - DOT_GAP - w, y0: right.y0, x1: p.x - DOT_GAP, y1: right.y1 };
    const inside = (b: Rect) => b.x0 >= 0 && b.x1 <= size.width && b.y0 >= 0 && b.y1 <= size.height;
    // Labels never overlap each other or another labelled marker's dot (unlabelled dots are tiny and may sit under a label).
    const free = (b: Rect) =>
      inside(b) &&
      !boxes.some((o) => hit(o, b)) &&
      !dots.some((d, i) => placed[i] !== r && labelled.has(placed[i]!.location.locationId) && hit(d, b));
    const isSel = r === selected;
    const choice = free(right) ? "right" : free(left) ? "left" : isSel ? "right" : null;
    if (!choice) continue;
    boxes.push(choice === "right" ? right : left);
    out.push({ id: r.location.locationId, side: choice });
  }
  return out;
}
