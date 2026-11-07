import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  buildCardUrl,
  isKnownSettingId,
  isRealDate,
  parseCardUrl,
  parseLandingUrl,
  parseSavedCardUrl,
  serializeLandingUrl,
  type LandingState,
} from "@/lib/url-state";
import { ATTENDEE_CATEGORIES, KINDS, VENUES, isKindId, isVenueId } from "@/ui-copy/planner-options";

const slug = fc.stringMatching(/^[a-z0-9-]{1,80}$/);
const date = fc
  .date({ min: new Date("2020-01-01T00:00:00Z"), max: new Date("2035-12-31T00:00:00Z"), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));
const venue = fc.constantFrom(...VENUES.map((v) => v.id));
const kind = fc.constantFrom(...KINDS.map((k) => k.id));
const cardParams = fc.record({ locationId: slug, eventDate: date, venue, kind });

describe("Property 7: URL builders round-trip and admit only public parameters (UI-4.3, UI-8.9, UI-15.2)", () => {
  it("card URLs round-trip", () => {
    fc.assert(
      fc.property(cardParams, (x) => {
        expect(parseCardUrl(buildCardUrl(x))).toEqual(x);
      }),
    );
  });

  it("card URLs contain only loc, date, setting", () => {
    fc.assert(
      fc.property(cardParams, (x) => {
        const keys = [...new URL(buildCardUrl(x), "http://x").searchParams.keys()].sort();
        expect(keys).toEqual(["date", "loc", "setting"]);
      }),
    );
  });

  it("landing URLs round-trip", () => {
    const landing: fc.Arbitrary<LandingState> = fc
      .record({
        virus: fc.constantFrom("covid19", "fluA", "fluB", "rsv" as const),
        city: fc.option(slug, { nil: undefined }),
        view: fc.option(fc.constantFrom("map", "list" as const), { nil: undefined }),
        discontinued: fc.option(fc.constant(true), { nil: undefined }),
      })
      .map((r) => {
        const s: LandingState = { virus: r.virus as LandingState["virus"] };
        if (r.city !== undefined) s.city = r.city;
        if (r.view !== undefined) s.view = r.view as "map" | "list";
        if (r.discontinued) s.discontinued = true;
        return s;
      });
    fc.assert(fc.property(landing, (x) => {
        expect(parseLandingUrl(serializeLandingUrl(x))).toEqual(x);
      }),
    );
  });

  it("landing URL falls back to defaults on junk", () => {
    expect(parseLandingUrl("virus=zzz&city=Bad City&view=3d")).toEqual({ virus: "covid19" });
  });

  it("settings outside the fixed lists are rejected", () => {
    fc.assert(
      fc.property(cardParams, fc.string(), (x, s) => {
        fc.pre(!(s.split(".").length === 2 && isVenueId(s.split(".")[0]!) && isKindId(s.split(".")[1]!)));
        const q = new URLSearchParams({ loc: x.locationId, date: x.eventDate, setting: s });
        expect(parseCardUrl(q)).toBeNull();
      }),
    );
  });

  it("any extra query key (e.g. attendee category) rejects the card URL", () => {
    fc.assert(
      fc.property(
        cardParams,
        fc.oneof(fc.constantFrom(...ATTENDEE_CATEGORIES, "attendees"), fc.string({ minLength: 1 })),
        fc.string(),
        (x, extra, val) => {
          fc.pre(!["loc", "date", "setting"].includes(extra));
          const q = new URLSearchParams(buildCardUrl(x).split("?")[1]);
          q.set(extra, val);
          expect(parseCardUrl(q)).toBeNull();
        },
      ),
    );
  });

  it("rejects non-calendar dates and duplicate keys", () => {
    expect(isRealDate("2026-02-30")).toBe(false);
    expect(isRealDate("2028-02-29")).toBe(true);
    expect(isKnownSettingId("indoor.family-dinner")).toBe(true);
    expect(parseCardUrl("loc=a&date=2026-02-30&setting=indoor.other")).toBeNull();
    expect(parseCardUrl("loc=a&loc=b&date=2026-12-21&setting=indoor.other")).toBeNull();
  });

  it("saved URLs accept only a uuid and nothing else", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(parseSavedCardUrl(`saved=${id}`)).toBe(id);
    expect(parseSavedCardUrl(`saved=${id}&loc=a`)).toBeNull();
    expect(parseSavedCardUrl("saved=nope")).toBeNull();
  });
});
