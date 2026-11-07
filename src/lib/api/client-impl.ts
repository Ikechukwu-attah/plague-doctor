/**
 * GET-only API client with injectable fetch (UI-2.5, UI-15.2).
 */
import { z } from "zod";
import type { MeasuredWeek } from "@/evidence/types";
import type { ApiClient, ApiResult, FetchLike } from "./client";
import { ApiError } from "./errors";
import type { ApiResource } from "./errors";
import {
  ApiEnvelopeSchema,
  DataStatusSchema,
  EnvelopeMetaSchema,
  LocationEntrySchema,
  MeasuredWeekSchema,
  StatusObservationSchema,
  StatusResponseSchema,
  parseSnapshotsLenient,
} from "./schemas";
import type { StatusResponse } from "./schemas";
import { buildApiUrl } from "./urls";
import type { StatusObservation } from "@/evidence/types";

/** Zod-backed implementation. Loaded lazily by `createApiClient` so the root layout does not ship Zod. */
export function createApiClientImpl(fetchImpl?: FetchLike): ApiClient {
  const doFetch: FetchLike =
    fetchImpl ?? ((input, init) => fetch(input, init) as ReturnType<FetchLike>);

  async function getRaw(resource: ApiResource, url: string, signal?: AbortSignal): Promise<unknown> {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await doFetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
        ...(signal ? { signal } : {}),
      });
    } catch {
      throw new ApiError(resource, "network", url);
    }
    if (res.status === 404) throw new ApiError(resource, "not_found", url, 404);
    if (!res.ok) throw new ApiError(resource, "http", url, res.status);
    try {
      return await res.json();
    } catch {
      throw new ApiError(resource, "parse", url, res.status);
    }
  }

  async function getParsed<S extends z.ZodTypeAny>(
    resource: ApiResource,
    url: string,
    dataSchema: S,
    signal?: AbortSignal,
  ): Promise<ApiResult<z.infer<S>>> {
    const raw = await getRaw(resource, url, signal);
    const parsed = ApiEnvelopeSchema(dataSchema).safeParse(raw);
    if (!parsed.success) throw new ApiError(resource, "parse", url);
    const { data, ...envelope } = parsed.data;
    return { data: data as z.infer<S>, envelope };
  }

  return {
    locations: (p = {}, signal) =>
      getParsed("locations", buildApiUrl("locations", p), z.array(LocationEntrySchema), signal),
    observations: (p = {}, signal) =>
      getParsed("observations", buildApiUrl("observations", p), z.array(StatusObservationSchema), signal) as Promise<ApiResult<StatusObservation[]>>,
    history: (p, signal) =>
      getParsed("history", buildApiUrl("history", p), z.array(MeasuredWeekSchema), signal) as Promise<ApiResult<MeasuredWeek[]>>,
    status: (p, signal) => getParsed("status", buildApiUrl("status", p), StatusResponseSchema, signal),
    dataStatus: (signal) => getParsed("data-status", buildApiUrl("data-status", {}), DataStatusSchema, signal),
    snapshots: async (signal) => {
      const url = buildApiUrl("snapshots", {});
      const raw = await getRaw("snapshots", url, signal);
      const envelope = EnvelopeMetaSchema.extend({ data: z.unknown() }).safeParse(raw);
      if (!envelope.success) throw new ApiError("snapshots", "parse", url);
      const lenient = parseSnapshotsLenient(envelope.data.data);
      if (!lenient) throw new ApiError("snapshots", "parse", url);
      const { data: _ignored, ...meta } = envelope.data;
      void _ignored;
      return { data: lenient.snapshots, envelope: meta, dropped: lenient.dropped };
    },
  };
}
