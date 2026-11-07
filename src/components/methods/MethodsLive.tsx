"use client";
import { useApi } from "@/lib/api/provider";
import { describeApiError } from "@/lib/api/errors";
import { useResource } from "@/lib/hooks/use-resource";
import { buildThreeClocks } from "@/lib/view/three-clocks";
import { buildCoverageFacts, buildIngestionFailure } from "@/lib/view/coverage-facts";
import { Button } from "@/components/design-system/Button";
import { useAnnounceOnChange } from "@/components/design-system/LiveRegionProvider";
import { RETRY, loadFailed, stateAnnouncement } from "@/ui-copy/states";
import { MethodsView } from "./MethodsView";

/** Fetches data-status, snapshots, locations and observations, then renders MethodsView. */
export function MethodsLive() {
  const { client } = useApi();
  const status = useResource("methods:data-status", () => client.dataStatus(), "data-status");
  const snaps = useResource("methods:snapshots", () => client.snapshots(), "snapshots");
  const locs = useResource("methods:locations", () => client.locations(), "locations");
  const obs = useResource("methods:observations", () => client.observations(), "observations");

  const statusData =
    status.state === "success"
      ? status.data
      : status.state === "error"
        ? status.lastGood?.data
        : undefined;
  const snapshots = snaps.state === "success" ? snaps.data : snaps.state === "error" ? snaps.lastGood?.data : undefined;

  const clocks =
    status.state === "loading" || (snaps.state === "loading" && statusData === undefined)
      ? null
      : statusData
        ? buildThreeClocks({ dataStatus: statusData, snapshots: snapshots ?? [] })
        : {};

  const coverage =
    locs.state === "success" && obs.state === "success"
      ? buildCoverageFacts({ locations: locs.data, observations: obs.data })
      : null;

  const failure = buildIngestionFailure({
    ...(statusData ? { dataStatus: statusData } : {}),
    ...(status.state === "error" ? { dataStatusError: status.error } : {}),
    ...(snapshots ? { snapshots } : {}),
  });

  const loadErrors: string[] = [];
  for (const r of [snaps, locs, obs]) {
    if (r.state === "error") loadErrors.push(describeApiError(r.error).message);
  }
  const retryAll = () => {
    for (const r of [status, snaps, locs, obs]) if (r.state === "error") r.retry();
  };
  const anyError = [status, snaps, locs, obs].some((r) => r.state === "error");
  useAnnounceOnChange(
    anyError
      ? loadFailed({ resource: "some methods data" })
      : clocks && coverage
        ? stateAnnouncement({ what: "Behind the mask data" })
        : null,
  );

  return (
    <MethodsView
      clocks={clocks}
      coverage={coverage}
      {...(failure ? { failure } : {})}
      loadErrors={loadErrors}
      {...(anyError ? { retry: <Button onClick={retryAll}>{RETRY}</Button> } : {})}
    />
  );
}
