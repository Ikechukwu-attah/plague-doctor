/**
 * Planner fixed options (UI-8.3, UI-8.6, C13). No free text anywhere in the planner.
 */
export const VENUES = [
  { id: "indoor", label: "Indoor" },
  { id: "outdoor", label: "Outdoor" },
  { id: "both", label: "Indoor and outdoor" },
] as const;

export const KINDS = [
  { id: "family-dinner", label: "Family dinner" },
  { id: "celebration", label: "Celebration" },
  { id: "worship", label: "Worship service" },
  { id: "school-work", label: "School or workplace event" },
  { id: "other", label: "Other gathering" },
] as const;

export const ATTENDEE_CATEGORIES = ["older adults", "infants", "immunocompromised"] as const;

export type VenueId = (typeof VENUES)[number]["id"];
export type KindId = (typeof KINDS)[number]["id"];
export type AttendeeCategory = (typeof ATTENDEE_CATEGORIES)[number];

export const PLANNER_STEPS = ["Where", "When", "Setting", "Who", "Confirm"] as const;
export type PlannerStep = (typeof PLANNER_STEPS)[number];

export const WHO_PRIVACY_NOTE = "These choices stay on this device and are never shared";
export const SKIP = "Skip";

export function isVenueId(v: string): v is VenueId {
  return VENUES.some((x) => x.id === v);
}

export function isKindId(v: string): v is KindId {
  return KINDS.some((x) => x.id === v);
}

/** `"{Venue} · {Kind}"` from the fixed labels (C13). */
export function settingLabel(venue: VenueId, kind: KindId): string {
  const v = VENUES.find((x) => x.id === venue)!.label;
  const k = KINDS.find((x) => x.id === kind)!.label;
  return `${v} · ${k}`;
}

export function kindLabel(kind: KindId): string {
  return KINDS.find((x) => x.id === kind)!.label;
}

export function confirmDisabledReason(s: { missing: PlannerStep }): string {
  return `Confirm is unavailable until you complete the ${s.missing} step.`;
}
