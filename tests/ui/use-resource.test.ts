/**
 * UI-2.10 UI-12.2 UI-12.4 — Property 22 plus API layer examples.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  initialResourceState,
  resourceReducer,
  selectResource,
} from "../../src/lib/hooks/resource-state";
import type { ResourceEvent, ResourceState } from "../../src/lib/hooks/resource-state";
import { ApiError, describeApiError, RESOURCE_NAMES } from "../../src/lib/api/errors";
import type { ApiResource } from "../../src/lib/api/errors";
import { ApiCache } from "../../src/lib/api/cache";
import { createApiClient } from "../../src/lib/api/client";
import type { FetchLike } from "../../src/lib/api/client";
import { buildApiUrl, parseApiUrl } from "../../src/lib/api/urls";
import { parseSnapshotsLenient } from "../../src/lib/api/schemas";
import { RETRY } from "../../src/ui-copy/states";

const RESOURCES = Object.keys(RESOURCE_NAMES) as ApiResource[];
const env = (n: number) => ({ snapshotId: "a".repeat(64), sampleWeek: `2026-10-${10 + (n % 10)}`, sourceUrl: "https://example.test/x" });

type Step =
  | { kind: "key"; key: string }
  | { kind: "ok"; key: string; value: number }
  | { kind: "fail"; key: string; resource: ApiResource };

const keyArb = fc.constantFrom("k1", "k2", "k3");
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  keyArb.map((key) => ({ kind: "key", key }) as Step),
  fc.record({ key: keyArb, value: fc.integer() }).map((r) => ({ kind: "ok", ...r }) as Step),
  fc.record({ key: keyArb, resource: fc.constantFrom(...RESOURCES) }).map((r) => ({ kind: "fail", ...r }) as Step),
);

describe("UI-2.10 UI-12.2 UI-12.4 Property 22 (synthetic sequences)", () => {
  it("never shows data for a different key; errors carry lastGood for the same key", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 40 }), (steps) => {
        let state: ResourceState<number> = initialResourceState<number>(null);
        let currentKey: string | null = null;
        const lastOk = new Map<string, number>();
        steps.forEach((step, i) => {
          let event: ResourceEvent<number>;
          if (step.kind === "key") {
            currentKey = step.key;
            event = { type: "key", key: step.key };
            state = resourceReducer(state, event);
            const r = selectResource(state, currentKey);
            expect(r.state).toBe("loading");
            expect("data" in r).toBe(false);
            return;
          }
          if (step.kind === "ok") {
            lastOk.set(step.key, step.value);
            state = resourceReducer(state, { type: "success", key: step.key, data: step.value, envelope: env(i) });
          } else {
            state = resourceReducer(state, {
              type: "failure",
              key: step.key,
              error: new ApiError(step.resource, "network", "/api/x"),
            });
          }
          const r = selectResource(state, currentKey);
          if (r.state === "success") {
            // data belongs to the current key and is its latest success
            expect(currentKey).not.toBeNull();
            expect(r.data).toBe(lastOk.get(currentKey as string));
          }
          if (r.state === "error") {
            const expected = lastOk.get(currentKey as string);
            if (expected === undefined) expect(r.lastGood).toBeUndefined();
            else expect(r.lastGood?.data).toBe(expected);
          }
          // a result for another key never changes what the current key shows
          if (currentKey !== null && step.key !== currentKey) {
            expect(r.state === "success" && r.data === lastOk.get(step.key) && lastOk.get(step.key) !== lastOk.get(currentKey)).toBe(false);
          }
        });
        // render-time selection for a key different from the state's key is loading
        expect(selectResource(state, "other-key").state).toBe("loading");
      }),
    );
  });

  it("every ApiError message names its resource and offers retry", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RESOURCES),
        fc.constantFrom("network" as const, "http" as const, "parse" as const, "not_found" as const),
        (resource, kind) => {
          const m = describeApiError(new ApiError(resource, kind, "/api/x", 500));
          expect(m.message).toContain(RESOURCE_NAMES[resource]);
          expect(m.message.startsWith("Couldn't load")).toBe(true);
          expect(m.retryLabel).toBe(RETRY);
        },
      ),
    );
  });
});

describe("UI-2.10 api layer examples", () => {
  it("retry after failure keeps lastGood for the same key", () => {
    let s = initialResourceState<string>("a");
    s = resourceReducer(s, { type: "success", key: "a", data: "v1", envelope: env(1) });
    s = resourceReducer(s, { type: "key", key: "a" });
    s = resourceReducer(s, { type: "failure", key: "a", error: new ApiError("locations", "http", "/api/locations", 500) });
    const r = selectResource(s, "a");
    expect(r.state === "error" && r.lastGood?.data).toBe("v1");
  });

  it("buildApiUrl admits only public params and round-trips", () => {
    const url = buildApiUrl("history", { locationId: "toronto", pathogen: "fluA", from: "2026-01-04" });
    expect(parseApiUrl(url)).toEqual({
      resource: "history",
      params: { locationId: "toronto", pathogen: "fluA", from: "2026-01-04" },
    });
    expect(parseApiUrl("/api/status?locationId=x&attendees=infants")).toBeNull();
    expect(parseApiUrl("/api/history?pathogen=ebola")).toBeNull();
    expect(buildApiUrl("snapshots", {})).toBe("/api/snapshots");
  });

  it("cache de-duplicates in-flight requests and retry forces a refetch", async () => {
    const cache = new ApiCache();
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return { data: calls, envelope: env(calls) };
    };
    const [a, b] = await Promise.all([cache.load("k", fetcher), cache.load("k", fetcher)]);
    expect(calls).toBe(1);
    expect(a.data).toBe(b.data);
    const forced = await cache.load("k", fetcher, true);
    expect(forced.data).toBe(2);
    expect(cache.peek<number>("k")?.data).toBe(2);
  });

  it("client maps failures to ApiError kinds and sends GET only", async () => {
    const methods: string[] = [];
    const make = (res: () => ReturnType<FetchLike>): FetchLike => (_u, init) => {
      methods.push(init.method);
      return res();
    };
    const body = (json: unknown, status = 200) => async () => ({ ok: status < 400, status, json: async () => json });
    const kind = async (f: FetchLike) => {
      try {
        await createApiClient(f).dataStatus();
        return "ok";
      } catch (e) {
        return e instanceof ApiError ? e.kind : "other";
      }
    };
    expect(await kind(make(async () => { throw new Error("offline"); }))).toBe("network");
    expect(await kind(make(body({}, 500)))).toBe("http");
    expect(await kind(make(body({}, 404)))).toBe("not_found");
    expect(await kind(make(body({ nope: true })))).toBe("parse");
    expect(
      await kind(make(body({ ...env(1), data: { snapshotCount: 1, lastSuccessfulFetch: null, latestSampleWeekByPathogen: {}, schemaVersion: null, trendSnapshotId: null } }))),
    ).toBe("ok");
    expect(new Set(methods)).toEqual(new Set(["GET"]));
  });

  it("snapshot lists drop invalid entries and count them", () => {
    const good = {
      snapshotId: "b".repeat(64), sourceUrl: "https://example.test/f.csv", fetchedAt: "2026-10-30T12:00:00.000Z",
      origin: "live", schemaVersion: "oct-2026", rowCount: 3, rejectedRows: 0, status: "valid",
    };
    const r = parseSnapshotsLenient([good, { junk: 1 }]);
    expect(r?.snapshots).toHaveLength(1);
    expect(r?.dropped).toBe(1);
    expect(parseSnapshotsLenient({})).toBeNull();
  });
});
