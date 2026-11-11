/**
 * Single source for the map's projected space (UI-20.5, UI-20.7). The viewBox is written by
 * scripts/build-geometry.ts into both canada-provinces.projected.json and city-points.json (a geometry test
 * asserts they are equal). It is read from city-points.json here because landing-rows already bundles that
 * file, so the skeleton does not pull the 21 KB outlines into the main chunk.
 */
import cityPoints from "@/data/geo/city-points.json";

const vb = cityPoints.viewBox;

export const MAP_W: number = vb[0] ?? 1600;
export const MAP_H: number = vb[1] ?? 900;
/** Width over height of the projected space; the map box and its skeleton use this aspect ratio. */
export const MAP_ASPECT: number = MAP_W / MAP_H;

/** Projected point to percent offsets inside the map box. */
export function markerPosition(p: { x: number; y: number }): { left: string; top: string } {
  return { left: `${(p.x / MAP_W) * 100}%`, top: `${(p.y / MAP_H) * 100}%` };
}
