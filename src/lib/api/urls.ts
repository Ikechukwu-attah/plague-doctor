/**
 * API URL builder/parser: public parameters only (UI-15.2).
 */
import type { Pathogen } from "@/evidence/types";
import { PathogenSchema } from "@/evidence/schemas";
import type { ApiResource } from "./errors";

export interface ParamMap {
  locations: { search?: string };
  observations: { locationId?: string; pathogen?: Pathogen; from?: string; to?: string };
  history: { locationId: string; pathogen: Pathogen; from?: string; to?: string };
  status: { locationId: string };
  "data-status": Record<string, never>;
  snapshots: Record<string, never>;
}

const ALLOWED = ["locationId", "pathogen", "from", "to", "search"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function buildApiUrl<R extends keyof ParamMap>(resource: R, params: ParamMap[R]): string {
  const sp = new URLSearchParams();
  const p = params as Record<string, string | undefined>;
  for (const key of ALLOWED) {
    const v = p[key];
    if (v !== undefined && v !== "") sp.set(key, v);
  }
  const qs = sp.toString();
  return `/api/${resource}${qs ? `?${qs}` : ""}`;
}

const RESOURCES: readonly ApiResource[] = [
  "locations",
  "observations",
  "history",
  "status",
  "data-status",
  "snapshots",
];

/** Parse a built URL; returns null for unknown resources, unknown params or bad values. */
export function parseApiUrl(
  url: string,
): { resource: ApiResource; params: Record<string, string> } | null {
  const m = /^\/api\/([a-z-]+)(?:\?(.*))?$/.exec(url);
  if (!m) return null;
  const resource = RESOURCES.find((r) => r === m[1]);
  if (!resource) return null;
  const params: Record<string, string> = {};
  const sp = new URLSearchParams(m[2] ?? "");
  for (const [k, v] of sp.entries()) {
    if (!(ALLOWED as readonly string[]).includes(k)) return null;
    if (k in params) return null;
    if (k === "pathogen" && !PathogenSchema.safeParse(v).success) return null;
    if ((k === "from" || k === "to") && !DATE_RE.test(v)) return null;
    params[k] = v;
  }
  return { resource, params };
}
