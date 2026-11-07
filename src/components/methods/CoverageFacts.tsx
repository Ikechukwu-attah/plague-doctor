import type { CoverageFactsModel } from "@/lib/view/coverage-facts";
import { Skeleton } from "@/components/design-system/Skeleton";
import { SECTION_HEADINGS, coverageFacts } from "@/ui-copy/methods";
import styles from "./Methods.module.css";

/** UI-11.9: counts derived from the current snapshot; null = still loading. */
export function CoverageFacts({ facts }: { facts: CoverageFactsModel | null }) {
  return (
    <section className={styles.section} aria-labelledby="methods-coverage">
      <h2 id="methods-coverage">{SECTION_HEADINGS.coverage}</h2>
      {facts === null ? (
        <Skeleton lines={2} />
      ) : (
        <>
          <p>{coverageFacts({ locations: facts.locations, discontinued: facts.discontinued })}</p>
          <ul className={styles.list}>
            <li>{facts.byGrouping.site} monitoring sites</li>
            <li>{facts.byGrouping.city} city-level rows</li>
            <li>{facts.byGrouping.province} provincial rows</li>
            <li>{facts.byGrouping.national} national rows</li>
            <li>{facts.withoutCoverage} places in our gazetteer without a PHAC city or site row</li>
          </ul>
        </>
      )}
    </section>
  );
}
