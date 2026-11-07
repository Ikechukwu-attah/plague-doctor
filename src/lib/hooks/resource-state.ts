/**
 * Pure core of useResource (UI-2.10, UI-12.2, UI-12.4; Property 22).
 */
import type { ApiError } from "@/lib/api/errors";
import type { EnvelopeMeta } from "@/lib/api/schemas";

export type Good<T> = { data: T; envelope: EnvelopeMeta };

export type Resource<T> =
  | { state: "loading" }
  | { state: "success"; data: T; envelope: EnvelopeMeta }
  | { state: "error"; error: ApiError; lastGood?: Good<T> };

export interface ResourceState<T> {
  key: string | null;
  current: Resource<T>;
  /** Most recent success per key. */
  good: Readonly<Record<string, Good<T>>>;
}

export type ResourceEvent<T> =
  | { type: "key"; key: string | null }
  | { type: "success"; key: string; data: T; envelope: EnvelopeMeta }
  | { type: "failure"; key: string; error: ApiError };

export function initialResourceState<T>(key: string | null = null): ResourceState<T> {
  return { key, current: { state: "loading" }, good: {} };
}

export function resourceReducer<T>(
  state: ResourceState<T>,
  event: ResourceEvent<T>,
): ResourceState<T> {
  switch (event.type) {
    case "key":
      // Never carry data across keys; a repeated key (retry) also goes back to loading.
      return { ...state, key: event.key, current: { state: "loading" } };
    case "success": {
      const good = { ...state.good, [event.key]: { data: event.data, envelope: event.envelope } };
      if (event.key !== state.key) return { ...state, good };
      return { ...state, good, current: { state: "success", data: event.data, envelope: event.envelope } };
    }
    case "failure": {
      if (event.key !== state.key) return state;
      const lastGood = state.good[event.key];
      return {
        ...state,
        current: lastGood
          ? { state: "error", error: event.error, lastGood }
          : { state: "error", error: event.error },
      };
    }
  }
}

/** Selector used at render time: a stale state for another key is always "loading". */
export function selectResource<T>(state: ResourceState<T>, key: string | null): Resource<T> {
  if (state.key !== key) return { state: "loading" };
  return state.current;
}
