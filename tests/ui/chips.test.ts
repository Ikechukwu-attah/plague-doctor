import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { nextVirus, VIRUS_CHIPS } from "@/lib/view/chips";

const virus = fc.constantFrom(...VIRUS_CHIPS);
const key = fc.oneof(
  fc.constantFrom("ArrowLeft", "ArrowRight", "Home", "End"),
  fc.string().filter((k) => !["ArrowLeft", "ArrowRight", "Home", "End"].includes(k)),
);

describe("Property 20: virus chip navigation (UI-2.2, UI-2.3)", () => {
  it("always returns one of four viruses and follows key semantics", () => {
    fc.assert(
      fc.property(virus, fc.array(key, { maxLength: 30 }), (start, keys) => {
        let cur = start;
        for (const k of keys) {
          const next = nextVirus(cur, k);
          const i = VIRUS_CHIPS.indexOf(cur);
          expect(VIRUS_CHIPS).toContain(next);
          if (k === "ArrowRight") expect(next).toBe(VIRUS_CHIPS[(i + 1) % 4]);
          else if (k === "ArrowLeft") expect(next).toBe(VIRUS_CHIPS[(i + 3) % 4]);
          else if (k === "Home") expect(next).toBe(VIRUS_CHIPS[0]);
          else if (k === "End") expect(next).toBe(VIRUS_CHIPS[3]);
          else expect(next).toBe(cur);
          cur = next;
        }
      }),
    );
  });

  it("wraps at both ends", () => {
    expect(nextVirus("rsv", "ArrowRight")).toBe("covid19");
    expect(nextVirus("covid19", "ArrowLeft")).toBe("rsv");
  });
});
