import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { generateShareText } from "@/evidence/share";
import { createApiClient, type FetchLike } from "@/lib/api/client";
import { createSavedEvents } from "@/lib/storage/saved-events";
import { createMemoryStorage } from "@/lib/storage/storage-port";
import { buildCardUrl } from "@/lib/url-state";
import { buildCardView } from "@/lib/view/card-view";
import { ATTENDEE_CATEGORIES, type KindId, type VenueId } from "@/ui-copy/planner-options";
import { allStrings, makeCard, OTTAWA, settingArb, TODAY, TORONTO } from "./card-helpers";

describe("attendees-memory is in-memory only (UI-8.7, UI-15.1)", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/attendees-memory.ts"), "utf8");
  for (const banned of ["localStorage", "sessionStorage", "document.cookie", "fetch", "indexedDB", "sendBeacon"]) {
    it(`does not reference ${banned}`, () => {
      expect(src).not.toContain(banned);
    });
  }
  it("imports only react and ui-copy", () => {
    const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["@/ui-copy/planner-options", "react"]);
  });
});

describe("Property 14: attendee categories never reach any output or request", () => {
  // Feature: interactive-surveillance-ui, Property 14: Attendee categories never reach any output or request
  it("UI-8.7 UI-9.11 UI-10.3 UI-15.1 UI-15.4 no output or request carries a category", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.subarray([...ATTENDEE_CATEGORIES], { minLength: 1 }),
        fc.constantFrom(TORONTO, OTTAWA),
        fc.integer({ min: -700, max: 120 }),
        settingArb,
        fc.boolean(),
        async (cats, loc, offsetDays, setting, keep) => {
          const card = makeCard({ loc, offsetDays, setting, attendees: cats });
          const [venue, kind] = setting.split(".") as [VenueId, KindId];
          const log: unknown[] = [];
          const stub: FetchLike = async (input, init) => {
            log.push({ input, ...init });
            return { ok: false, status: 404, json: async () => ({}) };
          };
          const client = createApiClient(stub);
          await client.status({ locationId: loc.locationId }).catch(() => undefined);
          await client.history({ locationId: loc.locationId, pathogen: "fluA" }).catch(() => undefined);
          expect(log.length).toBeGreaterThan(0);

          const mem = createMemoryStorage();
          const saved = createSavedEvents(mem).save(card, { keepAttendees: keep }, new Date("2026-10-31T16:00:00.000Z"));
          expect(saved.ok).toBe(true);
          const rawStored = mem.snapshot()["pd.savedEvents.v1"] ?? "";

          const outputs = [
            generateShareText(card),
            buildCardUrl({ locationId: loc.locationId, eventDate: card.eventDate, venue, kind }),
            JSON.stringify(log),
          ];
          for (const c of cats) {
            for (const o of outputs) expect(o.toLowerCase()).not.toContain(c.toLowerCase());
            if (!keep) expect(rawStored).not.toContain(c);
          }
          if (keep && saved.ok) {
            expect(saved.record.attendees).toEqual(ATTENDEE_CATEGORIES.filter((c) => cats.includes(c)));
            const without = JSON.stringify({ ...saved.record, attendees: undefined });
            for (const c of cats) expect(without).not.toContain(c);
          }
          // On-screen chips are the only place categories appear in the view.
          const view = buildCardView(card, TODAY);
          const rest = allStrings({ ...view, header: { ...view.header, attendeeChips: [] } })
            .join(" ")
            .toLowerCase();
          for (const c of cats) expect(rest).not.toContain(c.toLowerCase());
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---- Task 11.2: static bundle hygiene scan (UI-15.3, UI-16.4, UI-16.5) ----
function codeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...codeFiles(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("static bundle hygiene (UI-15.3, UI-16.4, UI-16.5)", () => {
  const files = ["src/app", "src/components", "src/lib"].flatMap((d) => codeFiles(join(process.cwd(), d)));
  const read = (f: string) => readFileSync(f, "utf8");

  it("scans a non-trivial set of files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("has no analytics or third-party script references", () => {
    const banned =
      /google-analytics|googletagmanager|gtag\(|plausible|segment\.com|mixpanel|hotjar|sentry|datadog|posthog|vercel\/analytics|next\/script|<script\b/i;
    for (const f of files) expect(read(f), f).not.toMatch(banned);
  });

  it("has no absolute https:// fetch targets or external src/href", () => {
    for (const f of files) {
      const s = read(f);
      expect(s, f).not.toMatch(/fetch\(\s*[`"']https?:\/\//);
      expect(s, f).not.toMatch(/\b(?:src|href)=["']https?:\/\//);
      expect(s, f).not.toMatch(/new\s+(?:URL|Request)\(\s*[`"']https?:\/\//);
    }
  });

  it("references only NEXT_PUBLIC_* from process.env", () => {
    for (const f of files) {
      const s = read(f);
      for (const m of s.matchAll(/process\.env\.([A-Za-z0-9_]+)/g)) {
        expect(m[1], f).toMatch(/^NEXT_PUBLIC_/);
      }
      expect(s, f).not.toMatch(/process\.env\s*(\[|\)|,|;)/);
    }
  });

  it("never uses dangerouslySetInnerHTML", () => {
    for (const f of files) expect(read(f), f).not.toContain("dangerouslySetInnerHTML");
  });

  it("next.config.ts sets the production security headers", () => {
    const cfg = read(join(process.cwd(), "next.config.ts"));
    for (const s of [
      "default-src 'self'",
      "connect-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "no-referrer",
      "nosniff",
    ]) {
      expect(cfg).toContain(s);
    }
  });
});
