/**
 * Marker dodge (UI-20.9 to UI-20.13, design Property 32). Pure and deterministic: no randomness, no time, no city names.
 *
 * Input: true marker centres in CSS pixels at the current map size. Output: display centres after a fixed-order
 * pairwise relaxation. Two markers "collide" when their square hit boxes (edge `hit`, min 24 px) overlap with
 * positive area. Colliding pairs are pushed apart along the line between their centres (a fixed direction derived
 * from the id order when they coincide) until their boxes just touch. Each marker is kept within `maxDisplacement`
 * of its true point and inside the map box. True coordinates are returned unchanged.
 *
 * If the density is higher than the displacement cap allows, the pairs still overlapping are reported in
 * `unresolved` (never silently); the positions stay within the cap.
 */
export const HIT_MIN = 24;
export const MAX_DISPLACEMENT = 40;
/** A marker whose display point is at least this far from its true point is "displaced" and gets a leader line. */
export const LEADER_MIN_PX = 2;
/** Extra clearance (px) when separating, so sub-pixel layout rounding never makes two 24 px boxes overlap. */
export const SEPARATION_GAP = 0.5;

export interface DodgePoint {
  id: string;
  x: number;
  y: number;
}

export interface DodgeOptions {
  /** Hit box edge in px. Default 24, never below 24. */
  hit?: number;
  /** Maximum distance between a display point and its true point, in px. Default 40. */
  maxDisplacement?: number;
  /** Map box in px; display points stay inside [0, width] x [0, height]. Omit for no box clamp. */
  bounds?: { width: number; height: number };
  /** Relaxation passes. Default 400. */
  iterations?: number;
}

export interface DodgedMarker {
  id: string;
  /** Display centre. */
  x: number;
  y: number;
  /** True projected centre, unchanged from the input. */
  trueX: number;
  trueY: number;
  displaced: boolean;
}

export interface DodgeResult {
  /** Ascending by id. */
  markers: DodgedMarker[];
  /** Pairs of ids whose hit boxes still overlap (density beyond the cap). */
  unresolved: Array<[string, string]>;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** True when two hit boxes of edge `hit` centred on a and b share interior area. */
export function hitBoxesOverlap(a: { x: number; y: number }, b: { x: number; y: number }, hit: number = HIT_MIN): boolean {
  return Math.abs(a.x - b.x) < hit - 1e-6 && Math.abs(a.y - b.y) < hit - 1e-6;
}

export function dodgeMarkers(points: readonly DodgePoint[], opts: DodgeOptions = {}): DodgeResult {
  const hit = Math.max(HIT_MIN, opts.hit ?? HIT_MIN);
  const cap = opts.maxDisplacement ?? MAX_DISPLACEMENT;
  const iterations = opts.iterations ?? 400;
  const bounds = opts.bounds;
  const src = [...points].sort((a, b) => cmp(a.id, b.id));
  const pos = src.map((p) => ({ x: p.x, y: p.y }));
  const n = src.length;

  const clamp = (i: number): void => {
    const p = pos[i]!;
    const t = src[i]!;
    let dx = p.x - t.x;
    let dy = p.y - t.y;
    const d = Math.hypot(dx, dy);
    if (d > cap) {
      dx = (dx / d) * cap;
      dy = (dy / d) * cap;
    }
    let x = t.x + dx;
    let y = t.y + dy;
    if (bounds) {
      x = Math.min(Math.max(x, 0), bounds.width);
      y = Math.min(Math.max(y, 0), bounds.height);
    }
    p.x = x;
    p.y = y;
  };

  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos[i]!;
        const b = pos[j]!;
        if (!hitBoxesOverlap(a, b, hit)) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        if (Math.hypot(dx, dy) < 1e-6) {
          // Coincident: a fixed direction per pair (golden-angle steps by index), so output is order independent.
          const ang = (i * 2.399963 + j * 0.61803) % (2 * Math.PI);
          dx = Math.cos(ang);
          dy = Math.sin(ang);
        }
        // Scale the separation vector so the Chebyshev distance reaches `hit` (boxes just touch).
        const cheb = Math.max(Math.abs(dx), Math.abs(dy));
        const k = (hit + SEPARATION_GAP) / cheb;
        const nx = dx * k;
        const ny = dy * k;
        const mx = (nx - dx) / 2;
        const my = (ny - dy) / 2;
        a.x -= mx;
        a.y -= my;
        b.x += mx;
        b.y += my;
        clamp(i);
        clamp(j);
        moved = true;
      }
    }
    if (!moved) break;
  }

  const markers = src.map<DodgedMarker>((t, i) => {
    const p = pos[i]!;
    return {
      id: t.id,
      x: p.x,
      y: p.y,
      trueX: t.x,
      trueY: t.y,
      displaced: Math.hypot(p.x - t.x, p.y - t.y) >= LEADER_MIN_PX,
    };
  });
  const unresolved: Array<[string, string]> = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (hitBoxesOverlap(pos[i]!, pos[j]!, hit)) unresolved.push([src[i]!.id, src[j]!.id]);
    }
  }
  return { markers, unresolved };
}
