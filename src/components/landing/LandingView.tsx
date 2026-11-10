"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Pathogen } from "@/evidence/types";
import { useApi } from "@/lib/api/provider";
import { describeApiError } from "@/lib/api/errors";
import type { ApiError } from "@/lib/api/errors";
import { useResource } from "@/lib/hooks/use-resource";
import type { Resource } from "@/lib/hooks/use-resource";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useToday } from "@/lib/clock";
import { parseLandingUrl, serializeLandingUrl } from "@/lib/url-state";
import type { LandingState } from "@/lib/url-state";
import { buildLandingRows } from "@/lib/view/landing-rows";
import { buildThreeClocks } from "@/lib/view/three-clocks";
import { deriveLandingStatus, staleWeekFor } from "@/lib/view/landing-status";
import { Button } from "@/components/design-system/Button";
import { Notice } from "@/components/design-system/Notice";
import { detailsLabel } from "@/ui-copy/landing";
import { useAnnounceOnChange } from "@/components/design-system/LiveRegionProvider";
import { VIRUS_LABEL } from "@/ui-copy/levels";
import { RETRY, loadFailed, stateAnnouncement } from "@/ui-copy/states";
import { useDetailMode } from "./detail-mode";
import { LandingScreen } from "./LandingScreen";
import styles from "./Landing.module.css";

/* Task 15.7: map (outlines, fog, markers) and detail surface load after the list is interactive. */
const LazyCanadaMap = dynamic(() => import("./CanadaMap").then((m) => m.CanadaMap), {
  ssr: false,
  loading: () => (
    <div className={styles.mapWrap} aria-busy="true">
      <div className={styles.mapBox} />
    </div>
  ),
});
const LazyDetailSurface = dynamic(() => import("./DetailSurface").then((m) => m.DetailSurface), {
  ssr: false,
});

const SEARCH_DEBOUNCE_MS = 250;

/** Current value of a resource, falling back to the last good value after a failed refresh. */
function valueOf<T>(r: Resource<T>): T | undefined {
  return r.state === "success" ? r.data : r.state === "error" ? r.lastGood?.data : undefined;
}
function blockingError<T>(r: Resource<T>): ApiError | undefined {
  return r.state === "error" && !r.lastGood ? r.error : undefined;
}

/** Client island for "/": four parallel reads, URL state, debounced search, detail surface. */
export function LandingView() {
  const { client } = useApi();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { todayIso } = useToday();
  const state = useMemo(() => parseLandingUrl(searchParams), [searchParams]);
  const { virus } = state;
  const showDiscontinued = state.discontinued === true;

  const locs = useResource("landing:locations", () => client.locations(), "locations");
  const obs = useResource("landing:observations", () => client.observations(), "observations");
  const dataStatus = useResource("landing:data-status", () => client.dataStatus(), "data-status");
  const snaps = useResource("landing:snapshots", () => client.snapshots(), "snapshots");

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);
  const searchActive = query.trim() !== "";
  const search = useResource(
    debounced ? `landing:search:${debounced}` : null,
    () => client.locations({ search: debounced }),
    "locations",
  );
  const searchPending = searchActive && (query.trim() !== debounced || search.state === "loading");

  const wide = useMediaQuery("(min-width: 640px)");
  const detailMode = useDetailMode();
  const [mapShown, setMapShown] = useState(state.view === "map");

  const update = useCallback(
    (patch: Partial<LandingState>) => {
      const next: LandingState = { ...state, ...patch };
      if (next.city === undefined) delete next.city;
      if (next.discontinued !== true) delete next.discontinued;
      if (next.sort === undefined) delete next.sort;
      router.replace(`${pathname}?${serializeLandingUrl(next)}`, { scroll: false });
    },
    [state, router, pathname],
  );

  const locationList = valueOf(locs);
  const observations = valueOf(obs);
  const snapshots = valueOf(snaps);
  const status = valueOf(dataStatus);

  const searchLocations =
    searchActive && !searchPending && search.state === "success" ? search.data : undefined;
  const listLocations = searchActive ? searchLocations : locationList;

  const rows = useMemo(
    () =>
      listLocations && observations
        ? buildLandingRows({
            locations: listLocations,
            observations,
            virus,
            today: todayIso,
            showDiscontinued,
          })
        : [],
    [listLocations, observations, virus, todayIso, showDiscontinued],
  );

  const landing = useMemo(
    () =>
      deriveLandingStatus({
        observations: observations ?? [],
        snapshots: snapshots ?? [],
        trendSnapshotId: status?.trendSnapshotId ?? null,
        today: todayIso,
      }),
    [observations, snapshots, status, todayIso],
  );

  const all = [locs, obs, dataStatus, snaps];
  const failedWithLastGood = all.some((r) => r.state === "error" && r.lastGood);
  const staleWeek = staleWeekFor({ status: landing, loadFailedWithLastGood: failedWithLastGood });
  const retryFailed = () => {
    for (const r of all) if (r.state === "error") r.retry();
  };

  const blocking = blockingError(locs) ?? blockingError(obs);
  const phase = blocking ? "error" : locationList && observations ? "ready" : "loading";

  useAnnounceOnChange(
    phase === "error"
      ? loadFailed({ resource: "locations" })
      : phase === "ready"
        ? stateAnnouncement({ what: `${VIRUS_LABEL[virus]} map` })
        : null,
  );

  const notices: string[] = [];
  const statusErr = blockingError(dataStatus);
  if (statusErr) notices.push(describeApiError(statusErr).message);
  const snapsErr = blockingError(snaps);
  if (snapsErr) notices.push(describeApiError(snapsErr).message);

  const clocks = status
    ? buildThreeClocks({ dataStatus: status, snapshots: snapshots ?? [] })
    : landing.latestWeek
      ? { sampleWeek: landing.latestWeek }
      : {};

  const open = (locationId: string) => {
    if (detailMode === "page") {
      router.push(`/city/${encodeURIComponent(locationId)}?virus=${virus}`);
      return;
    }
    update({ city: locationId });
  };

  const selected = state.city;
  const selectedName =
    locationList?.find((l) => l.locationId === selected)?.locationName ?? selected ?? "";
  const retryButton = <Button onClick={retryFailed}>{RETRY}</Button>;

  return (
    <LandingScreen
      mapComponent={LazyCanadaMap}
      virus={virus}
      onVirus={(v: Pathogen) => update({ virus: v })}
      phase={phase}
      {...(blocking
        ? {
            errorNotice: (
              <Notice tone="error" action={retryButton}>
                {describeApiError(blocking).message}
              </Notice>
            ),
          }
        : {})}
      {...(notices.length
        ? {
            notices: (
              <Notice tone="caution" action={retryButton}>
                {notices.join(". ")}
              </Notice>
            ),
          }
        : {})}
      {...(staleWeek ? { staleWeek, staleAction: failedWithLastGood ? retryButton : undefined } : {})}
      rows={rows}
      query={query}
      onQuery={setQuery}
      searching={searchPending}
      {...(searchActive && !searchPending && search.state === "error"
        ? {
            searchError: (
              <Notice tone="error" action={<Button onClick={search.retry}>{RETRY}</Button>}>
                {describeApiError(search.error).message}
              </Notice>
            ),
          }
        : {})}
      sort={state.sort === "activity" ? "activity" : "az"}
      onSort={(s) => update({ sort: s === "activity" ? "activity" : undefined })}
      showDiscontinued={showDiscontinued}
      onDiscontinued={(checked) => update({ discontinued: checked })}
      wide={wide}
      view={state.view ?? "map"}
      onView={(view) => update({ view })}
      mapShown={mapShown}
      onToggleMap={() => setMapShown((s) => !s)}
      {...(selected ? { selectedId: selected } : {})}
      onOpen={open}
      {...(landing.latestWeek ? { week: landing.latestWeek } : {})}
      clocks={clocks}
      {...(observations ? { freshness: landing.freshness } : {})}
      {...(selected && detailMode !== "page"
        ? {
            detail: (
              <LazyDetailSurface
                key={selected}
                locationId={selected}
                label={detailsLabel({ place: selectedName })}
                mode={detailMode}
                virus={virus}
                onClose={() => update({ city: undefined })}
              />
            ),
          }
        : {})}
    />
  );
}
