"use client";
/**
 * ApiProvider: one client and one memory cache per app instance.
 */
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { ApiCache } from "./cache";
import { createApiClient } from "./client";
import type { ApiClient, FetchLike } from "./client";

export interface ApiContextValue {
  client: ApiClient;
  cache: ApiCache;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider(props: { fetch?: FetchLike; children: ReactNode }) {
  const { fetch: fetchImpl, children } = props;
  const value = useMemo<ApiContextValue>(
    () => ({ client: createApiClient(fetchImpl), cache: new ApiCache() }),
    [fetchImpl],
  );
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi must be used inside ApiProvider");
  return ctx;
}
