/**
 * GET-only API client with injectable fetch (UI-2.5, UI-15.2).
 *
 * Task 15.7: this module is imported by the root layout (ApiProvider), so it carries no runtime
 * dependency on Zod. The validating implementation lives in `client-impl.ts` and is imported on
 * the first request, which happens after the first paint.
 */
import type { MeasuredWeek, SourceSnapshot, StatusObservation } from "@/evidence/types";
import type { ApiLocationEntry, DataStatusResponse, EnvelopeMeta, StatusResponse } from "./schemas";
import type { ParamMap } from "./urls";

export interface ApiResult<T> {
  data: T;
  envelope: EnvelopeMeta;
}

export type FetchLike = (
  input: string,
  init: { method: "GET"; headers: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface ApiClient {
  locations(p?: ParamMap["locations"], signal?: AbortSignal): Promise<ApiResult<ApiLocationEntry[]>>;
  observations(p?: ParamMap["observations"], signal?: AbortSignal): Promise<ApiResult<StatusObservation[]>>;
  history(p: ParamMap["history"], signal?: AbortSignal): Promise<ApiResult<MeasuredWeek[]>>;
  status(p: ParamMap["status"], signal?: AbortSignal): Promise<ApiResult<StatusResponse>>;
  dataStatus(signal?: AbortSignal): Promise<ApiResult<DataStatusResponse>>;
  snapshots(signal?: AbortSignal): Promise<ApiResult<SourceSnapshot[]> & { dropped: number }>;
}

export function createApiClient(fetchImpl?: FetchLike): ApiClient {
  let impl: Promise<ApiClient> | undefined;
  const load = (): Promise<ApiClient> =>
    (impl ??= import("./client-impl").then((m) => m.createApiClientImpl(fetchImpl)));
  return {
    locations: (p, signal) => load().then((c) => c.locations(p, signal)),
    observations: (p, signal) => load().then((c) => c.observations(p, signal)),
    history: (p, signal) => load().then((c) => c.history(p, signal)),
    status: (p, signal) => load().then((c) => c.status(p, signal)),
    dataStatus: (signal) => load().then((c) => c.dataStatus(signal)),
    snapshots: (signal) => load().then((c) => c.snapshots(signal)),
  };
}
