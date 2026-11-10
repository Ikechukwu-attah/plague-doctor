import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { clusterMarkers, HIT_SIZE, boxesOverlap } from "../../src/lib/view/marker-clusters";
import type { ClusterPoint } from "../../src/lib/view/marker-clusters";

const points = fc
  .uniqueArray(fc.record({ id: fc.stringMatching(/^[a-z]{1,6}$/), fx: fc.double({ min: 0, max: 1, noNaN: true }), fy: fc.double({ min: 0, max: 1, noNaN: true }) }), {
    selector: (p) => p.id,
    maxLength: 60,
  });
const size = fc.record({ width: fc.integer({ min: 200, max: 1600 }), height: fc.integer({ min: 200, max: 1400 }) });

describe("UI-19.1 UI-19.2 UI-19.3 UI-19.4 clusterMarkers", () => {
  // Feature: interactive-surveillance-ui, Property 23
  it("P23: hit boxes never overlap, every location appears once, centre hit test returns the item", () => {
    fc.assert(
      fc.property(points, size, (pts, s) => {
        const out = clusterMarkers(pts, s);
        for (let i = 0; i < out.length; i++) {
          for (let j = i + 1; j < out.length; j++) expect(boxesOverlap(out[i]!, out[j]!)).toBe(false);
        }
        const seen = out.flatMap((o) => o.memberIds).sort();
        expect(seen).toEqual(pts.map((p) => p.id).sort());
        for (const o of out) {
          // Boxes are 44 px: the centre of o lies inside only o's own box.
          const inside = out.filter((q) => Math.abs(o.x - q.x) < HIT_SIZE / 2 && Math.abs(o.y - q.y) < HIT_SIZE / 2);
          expect(inside.map((q) => q.id)).toEqual([o.id]);
          expect(o.kind).toBe(o.memberIds.length > 1 ? "cluster" : "marker");
        }
      }),
      { numRuns: 150 },
    );
  });

  it("is deterministic regardless of input order", () => {
    fc.assert(
      fc.property(points, size, (pts, s) => {
        const a = clusterMarkers(pts, s);
        const b = clusterMarkers([...pts].reverse(), s);
        expect(b).toEqual(a);
      }),
      { numRuns: 50 },
    );
  });

  it("keeps well separated markers as markers and merges touching ones", () => {
    const pts: ClusterPoint[] = [
      { id: "a", fx: 0.1, fy: 0.1 },
      { id: "b", fx: 0.9, fy: 0.9 },
      { id: "c", fx: 0.5, fy: 0.5 },
      { id: "d", fx: 0.51, fy: 0.5 },
    ];
    const out = clusterMarkers(pts, { width: 800, height: 600 });
    expect(out.map((o) => o.kind).sort()).toEqual(["cluster", "marker", "marker"]);
    expect(out.find((o) => o.kind === "cluster")!.memberIds).toEqual(["c", "d"]);
  });
});
