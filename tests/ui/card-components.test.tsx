import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OmenCard } from "../../src/components/card/OmenCard";
import { ShareTextPanel } from "../../src/components/card/ShareTextPanel";
import { SavedEventsPanel } from "../../src/components/card/SavedEventsPanel";
import { ChangeDiff } from "../../src/components/card/ChangeDiff";
import { Skeleton } from "../../src/components/design-system/Skeleton";
import { buildCardView } from "../../src/lib/view/card-view";
import { buildDiffView } from "../../src/lib/view/diff-view";
import { generateShareText } from "../../src/evidence/share";
import { PREVENTION_CHECKLIST } from "../../src/evidence/copy/checklist";
import { COMMUNITY_CAVEAT, ATTENDEES_ON_SCREEN_NOTE, NO_ATTENDEES_IN_SHARE } from "../../src/ui-copy/card";
import { OTTAWA, TODAY, TORONTO, makeCard } from "./card-helpers";
import { textOf } from "./helpers";

const SETTING = "indoor.family-dinner";
const html = (c: ReturnType<typeof makeCard>) =>
  renderToStaticMarkup(<OmenCard view={buildCardView(c, TODAY)} />);

describe("UI-9.1 UI-9.6 OmenCard markup", () => {
  it("near: dated strip, caveat, checklist, one row per virus", () => {
    const c = makeCard({ loc: TORONTO, offsetDays: 3, setting: SETTING, attendees: [] });
    const out = html(c);
    const t = textOf(out);
    expect(out).toContain('data-timing="near"');
    expect(t).toContain(COMMUNITY_CAVEAT);
    expect(t).toContain("not conditions on your date");
    for (const item of PREVENTION_CHECKLIST.items) expect(t).toContain(item);
    expect(out.match(/data-pathogen=/g)).toHaveLength(4);
  });

  it("too_early: says too early, no level badge and no 'as of' wording (UI-9.3)", () => {
    const c = makeCard({ loc: TORONTO, offsetDays: 60, setting: SETTING, attendees: [] });
    const out = html(c);
    const t = textOf(out);
    expect(out).toContain('data-timing="too_early"');
    expect(t).toContain("Too early to know");
    expect(t).toContain(COMMUNITY_CAVEAT);
    expect(out).not.toContain("data-activity=");
    expect(t).not.toMatch(/\bas of\b/i);
    expect(t).not.toContain("Observed:");
  });

  it("past: that year's measured week and the historical label (UI-9.4, UI-18.6)", () => {
    const c = makeCard({ loc: TORONTO, offsetDays: -200, setting: SETTING, attendees: [] });
    const out = html(c);
    expect(out).toContain('data-timing="past"');
    expect(textOf(out)).toContain("past observations, not a prediction");
    expect(textOf(out)).toContain(COMMUNITY_CAVEAT);
  });

  it("no_city_site: labelled provincial aggregate, never the city's own values (UI-9.7)", () => {
    const c = makeCard({ loc: OTTAWA, offsetDays: 2, setting: SETTING, attendees: [] });
    const t = textOf(html(c));
    expect(t).toContain("Ottawa");
    expect(t).toContain(COMMUNITY_CAVEAT);
  });

  it("attendee chips are on screen with the in-memory note, but never in share text (UI-9.11)", () => {
    const c = makeCard({ loc: TORONTO, offsetDays: 3, setting: SETTING, attendees: ["infants"] });
    const t = textOf(html(c));
    expect(t).toContain("infants");
    expect(t).toContain(ATTENDEES_ON_SCREEN_NOTE);
    expect(generateShareText(c)).not.toContain("infants");
  });

  it("loading state shows a shimmer and no values", () => {
    const out = renderToStaticMarkup(<Skeleton variant="card" />);
    expect(out).toContain('aria-busy="true"');
    expect(textOf(out)).not.toContain(COMMUNITY_CAVEAT);
  });
});

describe("UI-9.8 UI-9.9 ShareTextPanel", () => {
  it("shows exactly generateShareText(card)", () => {
    const c = makeCard({ loc: TORONTO, offsetDays: 3, setting: SETTING, attendees: ["older adults"] });
    const text = generateShareText(c);
    const out = renderToStaticMarkup(<ShareTextPanel text={text} />);
    const pre = /<pre[^>]*>([\s\S]*?)<\/pre>/.exec(out)?.[1] ?? "";
    expect(pre.replace(/&#x27;/g, "'").replace(/&amp;/g, "&")).toBe(text);
    expect(textOf(out)).toContain(NO_ATTENDEES_IN_SHARE);
    expect(out).not.toContain("<textarea");
  });
});

describe("UI-10.1 SavedEventsPanel", () => {
  it("offers explicit save, and the attendee checkbox is unchecked", () => {
    const c = makeCard({ loc: TORONTO, offsetDays: 3, setting: SETTING, attendees: ["infants"] });
    const out = renderToStaticMarkup(<SavedEventsPanel store={null} card={c} now={() => new Date()} />);
    expect(textOf(out)).toContain("Save to this device");
    expect(textOf(out)).toContain("Also keep who is attending on this device");
    expect(out).not.toContain("checked");
  });
});

describe("UI-10.9 ChangeDiff", () => {
  it("same snapshot reads as no newer snapshot", () => {
    const c = makeCard({ loc: TORONTO, offsetDays: 3, setting: SETTING, attendees: [] });
    const out = renderToStaticMarkup(<ChangeDiff view={buildDiffView(c, c)} />);
    expect(textOf(out)).toContain("No newer snapshot is available");
  });
});
