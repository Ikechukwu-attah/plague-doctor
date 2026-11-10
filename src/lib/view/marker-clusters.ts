/**
 * Map marker clustering (UI-19.1 to UI-19.4, doc 16.1). Pure and deterministic; no city names are hardcoded.
 *
 * Markers are 44 px hit targets. Any two markers whose boxes intersect at the current map size are merged,
 * and merging repeats (a cluster sits at the member centroid, which can touch another item) until no two
 * output hit boxes overlap. Every input id lands in exactly one output item.
 */
export const HIT_SIZE = 44;

export interface ClusterPoint {
  id: string;
  /** Horizontal position as a fraction of the map width (0 to 1). */
  fx: number;
  /** Vertical position as a fraction of the map height (0 to 1). */
  fy: number;
}

export interface ClusterMapSize {
  width: number;
  height: number;
}

export interface MarkerItem {
  kind: "marker" | "cluster";
  /** Location id for a marker; `cluster:{member ids joined by |}` for a cluster. */
  id: string;
  /** Centre in pixels at the given map size. */
  x: number;
  y: number;
  /** Centre as a fraction of the map size (for percent positioning). */
  fx: number;
  fy: number;
  /** Member location ids, ascending. One for a marker. */
  memberIds: string[];
}

interface Work {
  x: number;
  y: number;
  ids: string[];
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** True when two hit boxes of size `hit` centred on a and b share interior area. */
export function boxesOverlap(a: { x: number; y: number }, b: { x: number; y: number }, hit: number = HIT_SIZE): boolean {
  return Math.abs(a.x - b.x) < hit && Math.abs(a.y - b.y) < hit;
}

export function clusterMarkers(points: readonly ClusterPoint[], mapSize: ClusterMapSize, hitSize: number = HIT_SIZE): MarkerItem[] {
  let items: Work[] = [...points]
    .sort((a, b) => cmp(a.id, b.id))
    .map((p) => ({ x: p.fx * mapSize.width, y: p.fy * mapSize.height, ids: [p.id] }));
  for (;;) {
    let pair: [number, number] | null = null;
    outer: for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (boxesOverlap(items[i]!, items[j]!, hitSize)) {
          pair = [i, j];
          break outer;
        }
      }
    }
    if (!pair) break;
    const a = items[pair[0]]!;
    const b = items[pair[1]]!;
    const na = a.ids.length;
    const nb = b.ids.length;
    const merged: Work = {
      x: (a.x * na + b.x * nb) / (na + nb),
      y: (a.y * na + b.y * nb) / (na + nb),
      ids: [...a.ids, ...b.ids].sort(cmp),
    };
    items = items.filter((_, k) => k !== pair![0] && k !== pair![1]);
    items.push(merged);
  }
  return items
    .map<MarkerItem>((w) => ({
      kind: w.ids.length > 1 ? "cluster" : "marker",
      id: w.ids.length > 1 ? `cluster:${w.ids.join("|")}` : w.ids[0]!,
      x: w.x,
      y: w.y,
      fx: mapSize.width > 0 ? w.x / mapSize.width : 0,
      fy: mapSize.height > 0 ? w.y / mapSize.height : 0,
      memberIds: w.ids,
    }))
    .sort((a, b) => a.x - b.x || a.y - b.y || cmp(a.id, b.id));
}
