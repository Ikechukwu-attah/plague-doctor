import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildDiffView } from "@/lib/view/diff-view";
import { DIFF_UNCHANGED } from "@/ui-copy/card";
import { cardArb } from "./card-helpers";

describe("Property 17: diff presentation never presents a revision as a measured change", () => {
  // Feature: interactive-surveillance-ui, Property 17: Diff presentation never presents a revision as a measured change
  it("UI-10.6 UI-10.7 UI-10.8 UI-10.9 UI-10.10 wording per status", () => {
    fc.assert(
      fc.property(cardArb, cardArb, (a, b) => {
        const v = buildDiffView(a, b);
        expect(v.lines).toHaveLength(4);
        for (const l of v.lines) {
          expect(l.text).not.toMatch(/increasing|decreasing/i);
          if (l.status === "changed") {
            expect(l.text).toContain("newer observation:");
          } else {
            expect(l.text).not.toContain("newer observation");
            if (l.status === "revised") expect(l.text).toContain("revised");
            if (l.status === "newly_missing") expect(l.text).toContain("no longer reported");
          }
        }
        if (a.snapshotId === b.snapshotId) expect(v.state).toBe("no_newer_snapshot");
        else if (v.lines.every((l) => l.status === "unchanged")) {
          expect(v.state).toBe("all_unchanged");
          expect(v.message).toBe(DIFF_UNCHANGED);
        } else expect(v.state).toBe("has_changes");
      }),
      { numRuns: 150 },
    );
  });

  it("equal snapshots yield no_newer_snapshot", () => {
    fc.assert(fc.property(cardArb, (c) => { expect(buildDiffView(c, c).state).toBe("no_newer_snapshot"); }));
  });
});
