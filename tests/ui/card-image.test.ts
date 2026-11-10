/**
 * Card image and social metadata (UI-19.30, UI-19.31, UI-19.32; doc item 16.12).
 * Cards come from real PHAC fixtures; places and attendee subsets are synthetic.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCardImage, buildCardSvg, cardImageFilename, escapeXml } from "@/components/card/card-image";
import { buildCardView } from "@/lib/view/card-view";
import { socialMetadata } from "@/lib/social-metadata";
import { checkWording } from "@/evidence/wording-guard";
import { ATTENDEE_CATEGORIES } from "@/ui-copy/planner-options";
import * as social from "@/ui-copy/social";
import { COMMUNITY_CAVEAT } from "@/ui-copy/card";
import { OTTAWA, TODAY, TORONTO, attendeesArb, cardArb, makeCard, settingArb } from "./card-helpers";

const SETTING = "indoor.family-dinner";
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("UI-19.31 card image SVG builder", () => {
  it("escapes markup in place names and stays well formed", () => {
    const loc = { ...TORONTO, locationName: `A<b>&"it's"` };
    const svg = buildCardSvg(buildCardView(makeCard({ loc, offsetDays: 3, setting: SETTING, attendees: [] }), TODAY));
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("A&lt;b&gt;&amp;&quot;it&apos;s&quot;");
    expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
    expect(escapeXml("a\u0000b")).toBe("ab");
  });

  it("near card carries the caveat, a week-of line per virus and the event date", () => {
    const card = makeCard({ loc: TORONTO, offsetDays: 3, setting: SETTING, attendees: [] });
    expect(card.timingState).toBe("near");
    const svg = buildCardSvg(buildCardView(card, TODAY));
    expect(svg).toContain(COMMUNITY_CAVEAT);
    expect(svg).toMatch(/week of [A-Z][a-z]{2} \d{1,2}, \d{4}/);
    expect(svg).toContain("Event date:");
    expect(svg).toContain("Source: PHAC National Wastewater Monitoring");
    expect(svg).toContain("COVID-19");
  });

  it("every timing state carries the caveat and the title", () => {
    for (const offsetDays of [3, 90, -60]) {
      const card = makeCard({ loc: OTTAWA, offsetDays, setting: SETTING, attendees: [] });
      const view = buildCardView(card, TODAY);
      const svg = buildCardSvg(view);
      expect(svg).toContain(COMMUNITY_CAVEAT);
      expect(svg).toContain(escapeXml(view.header.title));
    }
  });

  it("UI-19.31 P11 never includes attendee categories, whatever was chosen", () => {
    fc.assert(
      fc.property(attendeesArb, settingArb, fc.integer({ min: -400, max: 100 }), (attendees, setting, offsetDays) => {
        const card = makeCard({ loc: TORONTO, offsetDays, setting, attendees });
        const svg = buildCardSvg(buildCardView(card, TODAY));
        for (const c of ATTENDEE_CATEGORIES) expect(svg.toLowerCase()).not.toContain(c.toLowerCase());
        // Same card with and without attendees yields the identical image.
        const without = buildCardSvg(buildCardView(makeCard({ loc: TORONTO, offsetDays, setting, attendees: [] }), TODAY));
        expect(svg).toBe(without);
      }),
      { numRuns: 60 },
    );
  });

  it("the SVG has no external references", () => {
    fc.assert(
      fc.property(cardArb, (card) => {
        const { svg } = buildCardImage(buildCardView(card, TODAY));
        // Only the SVG namespace may appear in an attribute; the source link is plain text.
        expect(svg).not.toMatch(/=["']https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
        expect(svg).not.toMatch(/href=|xlink|<image|url\(|@import|<script|<foreignObject/i);
      }),
      { numRuns: 40 },
    );
  });

  it("card-image.ts source contains no https:// URL", () => {
    expect(read("src/components/card/card-image.ts")).not.toContain("https://");
    expect(read("src/components/card/DownloadCardImage.tsx")).not.toContain("https://");
  });

  it("the builder never reads attendeeChips", () => {
    expect(read("src/components/card/card-image.ts")).not.toMatch(/attendee/i);
  });
});

describe("UI-19.31 file name", () => {
  it("is plague-doctor-card-{loc}-{eventDate}.png", () => {
    expect(cardImageFilename("toronto", "2026-11-10")).toBe("plague-doctor-card-toronto-2026-11-10.png");
  });

  it("sanitises the location id and never contains attendee words", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (id) => {
        const name = cardImageFilename(id, "2026-11-10");
        expect(name).toMatch(/^plague-doctor-card-[a-z0-9-]+-2026-11-10\.png$/);
      }),
    );
    expect(cardImageFilename("x", "not a date")).toBe("plague-doctor-card-x-undated.png");
    for (const c of ATTENDEE_CATEGORIES) {
      expect(cardImageFilename("toronto", "2026-11-10").toLowerCase()).not.toContain(c.toLowerCase());
    }
  });
});

describe("UI-19.30 social metadata", () => {
  const routes: Array<[string, social.SocialCopy]> = [
    ["home", social.SOCIAL_HOME],
    ["plan", social.SOCIAL_PLAN],
    ["card", social.SOCIAL_CARD],
    ["methods", social.SOCIAL_METHODS],
    ["city", social.SOCIAL_CITY],
    ["default", { title: social.SOCIAL_DEFAULT_TITLE, description: social.SOCIAL_DEFAULT_DESCRIPTION }],
  ];

  it.each(routes)("%s has Open Graph and a large Twitter card, with wording-guard clean copy", (_n, copy) => {
    const m = socialMetadata(copy);
    expect(m.openGraph?.title).toBe(copy.title);
    expect(m.openGraph?.description).toBe(copy.description);
    expect(m.twitter).toMatchObject({ card: "summary_large_image", title: copy.title });
    expect(checkWording(copy.title).violations).toEqual([]);
    expect(checkWording(copy.description).violations).toEqual([]);
  });

  it("static copy carries no date and no place name", () => {
    for (const [, c] of routes) expect(`${c.title} ${c.description}`).not.toMatch(/\b(19|20)\d{2}\b/);
    expect(checkWording(social.SOCIAL_TAGLINE).violations).toEqual([]);
  });

  it("layout sets metadataBase; the image routes perform no data fetch", () => {
    expect(read("src/app/layout.tsx")).toContain('const SITE_ORIGIN = "https://plague-doctor.vercel.app"');
    for (const f of ["src/app/opengraph-image.tsx", "src/app/twitter-image.tsx"]) {
      expect(read(f)).not.toMatch(/\bfetch\(|readFile|@\/server|@\/lib\/api|new Date|Date\.now/);
    }
  });

  it("city metadata does not read route params or fetch", () => {
    const src = read("src/app/city/[locationId]/page.tsx");
    const gm = src.slice(src.indexOf("export function generateMetadata"), src.indexOf("export default"));
    expect(gm).not.toMatch(/params|await|fetch/);
  });
});
