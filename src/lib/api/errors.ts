/**
 * API errors (UI-12.2, UI-12.4). Every error names its resource and offers retry.
 */
import { loadFailed, RETRY } from "@/ui-copy/states";

export type ApiResource =
  | "locations"
  | "observations"
  | "history"
  | "status"
  | "data-status"
  | "snapshots";

export type ApiErrorKind = "network" | "http" | "parse" | "not_found";

export class ApiError extends Error {
  readonly resource: ApiResource;
  readonly kind: ApiErrorKind;
  readonly url: string;
  readonly status?: number;

  constructor(resource: ApiResource, kind: ApiErrorKind, url: string, status?: number) {
    super(`${resource}: ${kind}`);
    this.name = "ApiError";
    this.resource = resource;
    this.kind = kind;
    this.url = url;
    if (status !== undefined) this.status = status;
  }
}

/** Human names used in "Couldn't load {resource}". */
export const RESOURCE_NAMES: Record<ApiResource, string> = {
  locations: "locations",
  observations: "observations",
  history: "history",
  status: "status",
  "data-status": "data status",
  snapshots: "snapshots",
};

export interface ApiErrorMessage {
  message: string;
  retryLabel: string;
}

/** Message for the error Notice: names the failed resource, offers retry. */
export function describeApiError(error: ApiError): ApiErrorMessage {
  return {
    message: loadFailed({ resource: RESOURCE_NAMES[error.resource] }),
    retryLabel: RETRY,
  };
}
