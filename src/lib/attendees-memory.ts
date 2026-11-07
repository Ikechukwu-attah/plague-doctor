/**
 * In-memory attendee categories (UI-8.7, UI-15.1). Module singleton: survives
 * client-side navigation, lost on reload. Deliberately imports nothing that can
 * persist or transmit data.
 */
import { useSyncExternalStore } from "react";
import { ATTENDEE_CATEGORIES, type AttendeeCategory } from "@/ui-copy/planner-options";

const EMPTY: readonly AttendeeCategory[] = Object.freeze([]);
let current: readonly AttendeeCategory[] = EMPTY;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function getAttendees(): readonly AttendeeCategory[] {
  return current;
}

export function setAttendees(next: readonly AttendeeCategory[]): void {
  const canon = ATTENDEE_CATEGORIES.filter((c) => next.includes(c));
  current = canon.length === 0 ? EMPTY : Object.freeze(canon);
  emit();
}

export function clearAttendees(): void {
  setAttendees([]);
}

export function subscribeAttendees(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useAttendees(): readonly AttendeeCategory[] {
  return useSyncExternalStore(subscribeAttendees, getAttendees, () => EMPTY);
}
