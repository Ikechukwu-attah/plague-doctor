/**
 * URL contracts (UI-4.3, UI-8.3, UI-8.9, UI-15.2). Every value here is public.
 * There is deliberately no parameter that can carry attendee categories.
 */
import { z } from "zod";
import { PathogenSchema } from "@/evidence/schemas";
import type { Pathogen } from "@/evidence/types";
import { isKindId, isVenueId, type KindId, type VenueId } from "@/ui-copy/planner-options";

export const DEFAULT_VIRUS: Pathogen = "covid19";

/** True for a real calendar date written `YYYY-MM-DD`. */
export function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const table = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[month - 1]!;
}

/** `"{venueId}.{kindId}"` drawn from the fixed planner lists. */
export function isKnownSettingId(s: string): boolean {
  const parts = s.split(".");
  return parts.length === 2 && isVenueId(parts[0]!) && isKindId(parts[1]!);
}

const SlugSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);

export const LandingUrlSchema = z.object({
  virus: PathogenSchema.catch(DEFAULT_VIRUS),
  city: SlugSchema.optional().catch(undefined),
  view: z.enum(["map", "list"]).optional().catch(undefined),
  discontinued: z.enum(["1"]).optional().catch(undefined),
});

export const CardUrlSchema = z
  .object({
    loc: SlugSchema,
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isRealDate),
    setting: z.string().refine(isKnownSettingId),
  })
  .strict();

export const SavedCardUrlSchema = z.object({ saved: z.string().uuid() }).strict();

export type UrlInput = string | URLSearchParams | Record<string, string | string[] | undefined>;

export interface LandingState {
  virus: Pathogen;
  city?: string;
  view?: "map" | "list";
  discontinued?: boolean;
}

export interface CardParams {
  locationId: string;
  eventDate: string;
  venue: VenueId;
  kind: KindId;
}

/** Collapse any accepted input into a plain object; repeated keys are rejected via an array value. */
function toRecord(input: UrlInput): Record<string, string | string[]> {
  let sp: URLSearchParams;
  if (typeof input === "string") {
    const q = input.includes("?") ? input.slice(input.indexOf("?") + 1) : input;
    sp = new URLSearchParams(q.split("#")[0]);
  } else if (input instanceof URLSearchParams) {
    sp = input;
  } else {
    const out: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(input)) if (v !== undefined) out[k] = v;
    return out;
  }
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of sp.entries()) {
    const prev = out[k];
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return out;
}

export function parseLandingUrl(input: UrlInput): LandingState {
  const r = toRecord(input);
  const p = LandingUrlSchema.parse({
    virus: r.virus,
    city: r.city,
    view: r.view,
    discontinued: r.discontinued,
  });
  const state: LandingState = { virus: p.virus };
  if (p.city !== undefined) state.city = p.city;
  if (p.view !== undefined) state.view = p.view;
  if (p.discontinued === "1") state.discontinued = true;
  return state;
}

/** Returns a query string (no leading `?`). */
export function serializeLandingUrl(s: LandingState): string {
  const sp = new URLSearchParams();
  sp.set("virus", s.virus);
  if (s.city) sp.set("city", s.city);
  if (s.view) sp.set("view", s.view);
  if (s.discontinued) sp.set("discontinued", "1");
  return sp.toString();
}

/** Returns `null` when the URL is not a valid card URL (including any extra key). */
export function parseCardUrl(input: UrlInput): CardParams | null {
  const res = CardUrlSchema.safeParse(toRecord(input));
  if (!res.success) return null;
  const [venue, kind] = res.data.setting.split(".") as [VenueId, KindId];
  return { locationId: res.data.loc, eventDate: res.data.date, venue, kind };
}

export function buildCardUrl(p: {
  locationId: string;
  eventDate: string;
  venue: VenueId;
  kind: KindId;
}): string {
  const sp = new URLSearchParams();
  sp.set("loc", p.locationId);
  sp.set("date", p.eventDate);
  sp.set("setting", `${p.venue}.${p.kind}`);
  return `/card?${sp.toString()}`;
}

/** Returns the saved-event id or `null`. */
export function parseSavedCardUrl(input: UrlInput): string | null {
  const res = SavedCardUrlSchema.safeParse(toRecord(input));
  return res.success ? res.data.saved : null;
}

export function serializeSavedCardUrl(id: string): string {
  return `/card?${new URLSearchParams({ saved: id }).toString()}`;
}
