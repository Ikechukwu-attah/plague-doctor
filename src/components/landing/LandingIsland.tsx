"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/design-system/Skeleton";
import { useApi } from "@/lib/api/provider";
import { LANDING_KEYS } from "./landing-ids";
import { MapPanelSkeleton } from "./MapPanelSkeleton";
import styles from "./Landing.module.css";

/**
 * Task 15.7: the data island is a separate chunk fetched after the first paint, so the route's
 * initial JS is only the shared React runtime. The server shell (h1 + limitation line) never
 * depends on it. The fallback reserves roughly a screen of height so the footer is not the
 * largest element painted and does not jump when the list arrives.
 *
 * Task 17.14 (UI-19.28): from 640 px the fallback also holds the map panel skeleton in the same grid as the
 * ready layout (hidden below 640 px by CSS, where the map is off by default), so the panel is never blank.
 */
export const LandingPending = () => (
  <div className={styles.pending}>
    <div className={styles.pendingHead} aria-hidden="true" />
    <div className={styles.pendingBody}>
      <div className={styles.pendingMap}>
        <div style={{ width: "100%" }}>
          <MapPanelSkeleton />
        </div>
      </div>
      <Skeleton variant="rows" rows={6} />
    </div>
  </div>
);

/** Starts the map chunk request. Not awaited by anything the data depends on (UI-19.29). */
export const loadMapChunk = () => import("./CanadaMap");

const WIDE_QUERY = "(min-width: 640px)";

/*
 * The view chunk, the validating API client and (when the map can be shown) the map chunk are all requested at
 * the same moment, so the map is no longer a request that starts only after the data has arrived.
 */
export function startMapChunk(): void {
  if (typeof window !== "undefined" && window.matchMedia?.(WIDE_QUERY).matches) void loadMapChunk().catch(() => undefined);
}

const LandingViewLazy = dynamic(() => Promise.all([import("./LandingView"), import("@/lib/api/client-impl"), startMapChunk()]).then(([m]) => m.LandingView), {
  ssr: false,
  loading: LandingPending,
});

export function LandingIsland() {
  const { client, cache } = useApi();
  // Start the four reads at mount, in parallel with the view chunk; LandingView joins the same in-flight requests.
  useEffect(() => {
    const ignore = () => undefined; // a failure is surfaced by LandingView, which retries on its own
    cache.load(LANDING_KEYS.locations, () => client.locations()).catch(ignore);
    cache.load(LANDING_KEYS.observations, () => client.observations()).catch(ignore);
    cache.load(LANDING_KEYS.dataStatus, () => client.dataStatus()).catch(ignore);
    cache.load(LANDING_KEYS.snapshots, () => client.snapshots()).catch(ignore);
  }, [client, cache]);
  return <LandingViewLazy />;
}
