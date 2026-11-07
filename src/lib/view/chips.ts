/** Virus chip keyboard navigation (UI-2.2, UI-2.3). Pure. */
import type { Pathogen } from "@/evidence/types";

export const VIRUS_CHIPS: readonly Pathogen[] = ["covid19", "fluA", "fluB", "rsv"];

/** ArrowLeft/Right wrap; Home/End jump; any other key leaves the selection unchanged. */
export function nextVirus(current: Pathogen, key: string): Pathogen {
  const i = VIRUS_CHIPS.indexOf(current);
  const n = VIRUS_CHIPS.length;
  switch (key) {
    case "ArrowRight":
      return VIRUS_CHIPS[(i + 1) % n]!;
    case "ArrowLeft":
      return VIRUS_CHIPS[(i - 1 + n) % n]!;
    case "Home":
      return VIRUS_CHIPS[0]!;
    case "End":
      return VIRUS_CHIPS[n - 1]!;
    default:
      return current;
  }
}
