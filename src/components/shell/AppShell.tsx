import type { ReactNode } from "react";
import { ApiProvider } from "@/lib/api/provider";
import { ClockProvider } from "@/lib/clock";
import { LiveRegionProvider } from "@/components/design-system/LiveRegionProvider";
import { SkipLink } from "./SkipLink";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import styles from "./Shell.module.css";

/** Skip link, header/nav, main#content, footer, and the three providers. */
export function AppShell(props: { children: ReactNode }) {
  return (
    <LiveRegionProvider>
      <ClockProvider>
        <ApiProvider>
          <SkipLink />
          <SiteHeader />
          <main id="content" tabIndex={-1} className={styles.main}>
            {props.children}
          </main>
          <SiteFooter />
        </ApiProvider>
      </ClockProvider>
    </LiveRegionProvider>
  );
}
