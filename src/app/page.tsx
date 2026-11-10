import { Suspense } from "react";
import type { Metadata } from "next";
import { LandingIsland, LandingPending } from "@/components/landing/LandingIsland";
import { LANDING_HEADING, limitation } from "@/ui-copy/states";
import { socialMetadata } from "@/lib/social-metadata";
import { SOCIAL_HOME } from "@/ui-copy/social";
import styles from "@/components/landing/Landing.module.css";

export const metadata: Metadata = socialMetadata(SOCIAL_HOME);

/** Server shell: heading and limitation line are in the first HTML; data loads in the client island. */
export default function Home() {
  return (
    <>
      <header className={styles.intro}>
        <h1>{LANDING_HEADING}</h1>
        <p>{limitation()}</p>
      </header>
      <Suspense fallback={<LandingPending />}>
        <LandingIsland />
      </Suspense>
    </>
  );
}
