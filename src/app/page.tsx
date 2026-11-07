import { Suspense } from "react";
import type { Metadata } from "next";
import { LandingView } from "@/components/landing/LandingView";
import { Skeleton } from "@/components/design-system/Skeleton";
import { LANDING_HEADING, limitation } from "@/ui-copy/states";
import styles from "@/components/landing/Landing.module.css";

export const metadata: Metadata = {
  title: "What's in the water? — Plague Doctor",
  description: limitation(),
};

/** Server shell: heading and limitation line are in the first HTML; data loads in the client island. */
export default function Home() {
  return (
    <>
      <header className={styles.intro}>
        <h1>{LANDING_HEADING}</h1>
        <p>{limitation()}</p>
      </header>
      <Suspense fallback={<Skeleton variant="rows" rows={6} />}>
        <LandingView />
      </Suspense>
    </>
  );
}
