/**
 * Omen Card restyle (task 17.10, UI-19.25..27). Property 28: voice lines.
 * Contrast tests for the new ornament tokens live here too.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { renderToStaticMarkup } from "react-dom/server";
import { OmenCard } from "../../src/components/card/OmenCard";
import { buildCardView } from "../../src/lib/view/card-view";
import { generateShareText } from "../../src/evidence/share";
import { checkWording } from "../../src/evidence/wording-guard";
import { CARD_VOICE_LINES, cardVoiceLine, type VoiceLevel } from "../../src/ui-copy/card";
import { TODAY, TORONTO, cardArb, makeCard } from "./card-helpers";
import { textOf } from "./helpers";

function lum(h: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

const LEVELS: VoiceLevel[] = ["high", "moderate", "low", "not_detected", "unknown"];
const EXTRA_BANNED = /\b(safe|danger\w*|you will|forecast\w*|predict\w*|risk\w*)\b|\d|%/i;
const LEVEL_WORDS = /\b(low|high|moderate|not detected|no data)\b/i;

describe("P28 UI-19.25 voice lines", () => {
  it("one line per level, each passes the wording guard, none has banned words", () => {
    fc.assert(
      fc.property(fc.constantFrom(...LEVELS), (lvl) => {
        const line = cardVoiceLine(lvl);
        expect(line).toBe(CARD_VOICE_LINES[lvl]);
        expect(checkWording(line).passed).toBe(true);
        expect(line).not.toMatch(EXTRA_BANNED);
        expect(line).not.toMatch(LEVEL_WORDS);
      }),
    );
    expect(Object.keys(CARD_VOICE_LINES).sort()).toEqual([...LEVELS].sort());
    expect(new Set(Object.values(CARD_VOICE_LINES)).size).toBe(LEVELS.length);
  });
  it("unknown line does not imply absence or a low level", () => {
    expect(cardVoiceLine("unknown")).not.toMatch(/\b(none|nothing|no (signal|virus|trace)|absent|clear)\b/i);
  });
});

describe("UI-19.26 voice lines in the card", () => {
  const render = (offsetDays: number) =>
    renderToStaticMarkup(
      <OmenCard view={buildCardView(makeCard({ loc: TORONTO, offsetDays, setting: "indoor.family-dinner", attendees: [] }), TODAY)} />,
    );
  it("near cards show one voice line per virus row, matching that row's level", () => {
    const out = render(3);
    expect(out.match(/data-voice="/g)).toHaveLength(4);
    for (const m of out.matchAll(/data-voice="(\w+)">([^<]*)</g)) {
      expect(m[2]).toBe(CARD_VOICE_LINES[m[1] as VoiceLevel]);
    }
    expect(out).toContain('data-testid="wax-seal"');
  });
  it("too-early and past cards carry no voice line (Property 13 intact)", () => {
    for (const off of [60, -200]) {
      const out = render(off);
      expect(out).not.toContain("data-voice=");
      for (const l of LEVELS) expect(textOf(out)).not.toContain(CARD_VOICE_LINES[l]);
    }
  });
});

describe("UI-19.27 share text unchanged by the restyle", () => {
  it("is deterministic, free of voice lines and matches the stored snapshot", () => {
    const c = makeCard({ loc: TORONTO, offsetDays: 3, setting: "indoor.family-dinner", attendees: [] });
    const text = generateShareText(c);
    expect(generateShareText(c)).toBe(text);
    expect(text).toMatchSnapshot();
  });
  it("never contains a voice line for any card", () => {
    fc.assert(
      fc.property(cardArb, (c) => {
        const t = generateShareText(c);
        for (const l of LEVELS) expect(t).not.toContain(CARD_VOICE_LINES[l]);
      }),
      { numRuns: 40 },
    );
  });
});

describe("UI-19 contrast for new Omen Card tokens", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const tok = (n: string) => css.match(new RegExp(`--${n}\\s*:\\s*(#[0-9a-fA-F]{6})`))![1]!;
  it("seal glyph on wax >= 3:1 (graphic) and in fact >= 4.5", () => {
    expect(ratio(tok("seal-glyph"), tok("seal-wax"))).toBeGreaterThanOrEqual(4.5);
  });
  it("ornate border on parchment >= 3:1", () => {
    expect(ratio(tok("paper-border"), tok("parchment"))).toBeGreaterThanOrEqual(3);
  });
  it("voice line ink #3a3528 on parchment >= 4.5:1", () => {
    expect(ratio("#3a3528", tok("parchment"))).toBeGreaterThanOrEqual(4.5);
  });
  it("no new animation in the card stylesheet", () => {
    const card = readFileSync(join(process.cwd(), "src/components/card/Card.module.css"), "utf8");
    expect(card).not.toMatch(/@keyframes|animation\s*:/);
  });
});
