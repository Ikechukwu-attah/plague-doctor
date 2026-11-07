/**
 * Saved-event store (UI-10.1–10.5, 10.11, 10.12, 15.5).
 * `save` is the only writer. Unreadable records are skipped, never thrown, and
 * are preserved on disk until the user deletes them.
 */
import type { EventCard } from "@/evidence/card-types";
import { ATTENDEE_CATEGORIES } from "@/ui-copy/planner-options";
import type { StoragePort } from "./storage-port";
import { SavedEventRecordSchema, STORAGE_KEY, type SavedEventRecord } from "./saved-event-schema";

export type SaveResult =
  | { ok: true; record: SavedEventRecord }
  | { ok: false; reason: "unavailable" | "quota" };

export interface SavedEventsApi {
  list(): { records: SavedEventRecord[]; unreadable: Array<{ index: number }> };
  save(card: EventCard, opts: { keepAttendees: boolean }, now: Date): SaveResult;
  remove(id: string): void;
  /** Delete one unreadable entry by its index in the stored array. */
  removeUnreadable(index: number): void;
  removeAll(): void;
  toEventCard(r: SavedEventRecord): EventCard;
}

function readRaw(port: StoragePort): unknown[] {
  let text: string | null;
  try {
    text = port.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (text === null) return [];
  try {
    const v: unknown = JSON.parse(text);
    return Array.isArray(v) ? (v as unknown[]) : [];
  } catch {
    return [];
  }
}

function classify(raw: unknown): SavedEventRecord | null {
  const r = SavedEventRecordSchema.safeParse(raw);
  return r.success ? r.data : null;
}

function isQuota(e: unknown): boolean {
  return typeof e === "object" && e !== null && "name" in e && (e as { name: unknown }).name === "QuotaExceededError";
}

function randomId(): string {
  return globalThis.crypto.randomUUID();
}

export function createSavedEvents(port: StoragePort, newId: () => string = randomId): SavedEventsApi {
  function write(items: unknown[]): void {
    if (items.length === 0) port.removeItem(STORAGE_KEY);
    else port.setItem(STORAGE_KEY, JSON.stringify(items));
  }
  function safeWrite(items: unknown[]): void {
    try {
      write(items);
    } catch {
      /* deletion failures leave state unchanged */
    }
  }

  return {
    list() {
      const records: SavedEventRecord[] = [];
      const unreadable: Array<{ index: number }> = [];
      readRaw(port).forEach((raw, index) => {
        const rec = classify(raw);
        if (rec) records.push(rec);
        else unreadable.push({ index });
      });
      return { records, unreadable };
    },

    save(card, opts, now) {
      // attendeeCategories is dropped here; the stored card schema has no such key.
      const { attendeeCategories, ...stored } = card;
      const attendees = ATTENDEE_CATEGORIES.filter((c) => attendeeCategories.includes(c));
      const candidate = {
        schemaVersion: 1 as const,
        id: newId(),
        savedAt: now.toISOString(),
        baselineSnapshotId: card.snapshotId,
        card: stored,
        ...(opts.keepAttendees && attendees.length > 0 ? { attendees } : {}),
      };
      const parsed = SavedEventRecordSchema.safeParse(candidate);
      if (!parsed.success) return { ok: false, reason: "unavailable" };
      try {
        const existing = port.getItem(STORAGE_KEY) === null ? [] : readRaw(port);
        port.setItem(STORAGE_KEY, JSON.stringify([...existing, parsed.data]));
      } catch (e) {
        return { ok: false, reason: isQuota(e) ? "quota" : "unavailable" };
      }
      return { ok: true, record: parsed.data };
    },

    remove(id) {
      const items = readRaw(port);
      const next = items.filter((raw) => classify(raw)?.id !== id);
      if (next.length !== items.length) safeWrite(next);
    },

    removeUnreadable(index) {
      const items = readRaw(port);
      if (index < 0 || index >= items.length || classify(items[index])) return;
      safeWrite(items.filter((_, i) => i !== index));
    },

    removeAll() {
      try {
        port.removeItem(STORAGE_KEY);
      } catch {
        /* nothing else to do */
      }
    },

    toEventCard(r) {
      return { ...(r.card as Omit<EventCard, "attendeeCategories">), attendeeCategories: [...(r.attendees ?? [])] };
    },
  };
}
