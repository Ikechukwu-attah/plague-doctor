"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/design-system/Skeleton";
import styles from "./Landing.module.css";

/**
 * Task 15.7: the data island is a separate chunk fetched after the first paint, so the route's
 * initial JS is only the shared React runtime. The server shell (h1 + limitation line) never
 * depends on it. The fallback reserves roughly a screen of height so the footer is not the
 * largest element painted and does not jump when the list arrives.
 */
export const LandingPending = () => (
  <div className={styles.pending}>
    <Skeleton variant="rows" rows={6} />
  </div>
);

/* The validating API client is fetched in parallel with the view so the four reads are not one chunk later. */
const LandingViewLazy = dynamic(() => Promise.all([import("./LandingView"), import("@/lib/api/client-impl")]).then(([m]) => m.LandingView), {
  ssr: false,
  loading: LandingPending,
});

export function LandingIsland() {
  return <LandingViewLazy />;
}
