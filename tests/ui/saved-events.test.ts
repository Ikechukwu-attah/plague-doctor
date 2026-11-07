import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { createSavedEvents } from "@/lib/storage/saved-events";
import { createMemoryStorage, type StoragePort } from "@/lib/storage/storage-port";
import { STORAGE_KEY } from "@/lib/storage/saved-event-schema";
import { cardArb } from "./card-helpers";

const NOW = new Date("2026-10-31T16:00:00.000Z");
let n = 0;
const ids = () => "00000000-0000-4000-8000-" + String(++n).padStart(12, "0");

describe("Property 15: saved-event records round-trip and corrupt storage never throws", () => {
  // Feature: interactive-surveillance-ui, Property 15: Saved-event records round-trip and corrupt storage never throws
  it("UI-10.2 UI-10.3 round-trips through JSON", () => {
    fc.assert(
      fc.property(cardArb, fc.boolean(), (card, keep) => {
        const api = createSavedEvents(createMemoryStorage(), ids);
        const res = api.save(card, { keepAttendees: keep }, NOW);
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const back = api.list().records[0]!;
        expect(JSON.parse(JSON.stringify(back))).toEqual(JSON.parse(JSON.stringify(res.record)));
        const restored = api.toEventCard(back);
        const canonical = card.attendeeCategories.length > 0 && keep ? back.attendees : [];
        expect(restored).toEqual({ ...card, attendeeCategories: canonical });
        expect(back.baselineSnapshotId).toBe(card.snapshotId);
        expect(restored.createdAt).toBe(card.createdAt);
      }),
      { numRuns: 100 },
    );
  });

  it("UI-10.12 arbitrary storage content never throws; valid records survive", () => {
    fc.assert(
      fc.property(cardArb, fc.oneof(fc.string(), fc.json()), (card, junk) => {
        const good = createSavedEvents(createMemoryStorage(), ids);
        const saved = good.save(card, { keepAttendees: false }, NOW);
        if (!saved.ok) throw new Error("save failed");
        const mixed = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify([saved.record, junk]) });
        const out = createSavedEvents(mixed).list();
        expect(out.records.length).toBe(1);
        expect(out.unreadable).toEqual([{ index: 1 }]);
        const raw = createMemoryStorage({ [STORAGE_KEY]: junk });
        const r = createSavedEvents(raw).list();
        expect(Array.isArray(r.records)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

type Op = { t: "save"; i: number; keep: boolean } | { t: "remove"; k: number } | { t: "removeAll" };

describe("Property 16: the saved-event store behaves like a list model and writes only on save", () => {
  // Feature: interactive-surveillance-ui, Property 16: The saved-event store behaves like a list model and writes only on save
  it("UI-10.1 UI-10.4 UI-10.5 UI-10.11 UI-15.5 list model", () => {
    const op: fc.Arbitrary<Op> = fc.oneof(
      fc.record({ t: fc.constant("save" as const), i: fc.nat(4), keep: fc.boolean() }),
      fc.record({ t: fc.constant("remove" as const), k: fc.nat(10) }),
      fc.constant({ t: "removeAll" as const }),
    );
    fc.assert(
      fc.property(fc.array(cardArb, { minLength: 5, maxLength: 5 }), fc.array(op, { maxLength: 12 }), (cards, ops) => {
        const mem = createMemoryStorage();
        let sets = 0;
        const port: StoragePort = {
          getItem: (k) => mem.getItem(k),
          setItem: (k, v) => {
            sets++;
            mem.setItem(k, v);
          },
          removeItem: (k) => mem.removeItem(k),
        };
        const api = createSavedEvents(port, ids);
        expect(sets).toBe(0);
        api.list();
        expect(sets).toBe(0);
        let model: string[] = [];
        for (const o of ops) {
          if (o.t === "save") {
            const r = api.save(cards[o.i]!, { keepAttendees: o.keep }, NOW);
            if (r.ok) model.push(r.record.id);
          } else if (o.t === "remove") {
            const id = model[o.k % Math.max(model.length, 1)];
            if (id) {
              const gone = api.list().records.find((r) => r.id === id)!;
              api.remove(id);
              model = model.filter((x) => x !== id);
              const rawText = mem.getItem(STORAGE_KEY) ?? "";
              const remaining = api.list().records;
              for (const c of gone.attendees ?? []) {
                if (!remaining.some((r) => r.attendees?.includes(c))) expect(rawText).not.toContain(c);
              }
            }
          } else {
            api.removeAll();
            model = [];
            expect(mem.getItem(STORAGE_KEY)).toBeNull();
          }
          expect(api.list().records.map((r) => r.id)).toEqual(model);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("UI-10.11 a throwing port makes save return ok:false and leaves state unchanged", () => {
    fc.assert(
      fc.property(cardArb, fc.constantFrom("QuotaExceededError", "SecurityError"), (card, name) => {
        const mem = createMemoryStorage();
        const port: StoragePort = {
          getItem: (k) => mem.getItem(k),
          setItem: () => {
            throw Object.assign(new Error("x"), { name });
          },
          removeItem: (k) => mem.removeItem(k),
        };
        const r = createSavedEvents(port, ids).save(card, { keepAttendees: true }, NOW);
        expect(r).toEqual({ ok: false, reason: name === "QuotaExceededError" ? "quota" : "unavailable" });
        expect(mem.snapshot()).toEqual({});
      }),
    );
  });
});
