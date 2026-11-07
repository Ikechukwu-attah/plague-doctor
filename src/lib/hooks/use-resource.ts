"use client";
import { useCallback, useEffect, useReducer, useState } from "react";
import { useApi } from "@/lib/api/provider";
import { ApiError } from "@/lib/api/errors";
import type { ApiResource } from "@/lib/api/errors";
import type { EnvelopeMeta } from "@/lib/api/schemas";
import { initialResourceState, resourceReducer, selectResource } from "./resource-state";
import type { Resource, ResourceState, ResourceEvent } from "./resource-state";

export type { Resource } from "./resource-state";

/**
 * Loads `fetcher()` for `key` (null = idle/loading). Results for superseded keys are ignored.
 * `fallbackResource` names the resource if the fetcher throws a non-ApiError.
 */
export function useResource<T>(
  key: string | null,
  fetcher: () => Promise<{ data: T; envelope: EnvelopeMeta }>,
  fallbackResource: ApiResource = "status",
): Resource<T> & { retry(): void } {
  const { cache } = useApi();
  const [state, dispatch] = useReducer(
    (s: ResourceState<T>, e: ResourceEvent<T>) => resourceReducer(s, e),
    null,
    () => initialResourceState<T>(null),
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    dispatch({ type: "key", key });
    if (key === null) return;
    let cancelled = false;
    cache
      .load<T>(key, fetcher, attempt > 0)
      .then((entry) => {
        if (!cancelled) dispatch({ type: "success", key, data: entry.data, envelope: entry.envelope });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const error =
          err instanceof ApiError ? err : new ApiError(fallbackResource, "network", key);
        dispatch({ type: "failure", key, error });
      });
    return () => {
      cancelled = true;
    };
    // fetcher intentionally excluded: the key identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, cache]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...selectResource(state, key), retry };
}
