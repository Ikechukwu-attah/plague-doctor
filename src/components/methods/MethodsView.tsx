import type { ReactNode } from "react";
import type { ThreeClocksModel } from "@/lib/view/three-clocks";
import type { CoverageFactsModel, IngestionFailureModel } from "@/lib/view/coverage-facts";
import { Notice } from "@/components/design-system/Notice";
import { Skeleton } from "@/components/design-system/Skeleton";
import { ThreeClocks } from "@/components/design-system/ThreeClocks";
import { SECTION_HEADINGS, ingestionFailure, schemaVersionLine, snapshotIdLine } from "@/ui-copy/methods";
import { THREE_CLOCKS } from "@/ui-copy/states";
import { SourceList } from "./SourceList";
import { Definitions } from "./Definitions";
import { LimitsList } from "./LimitsList";
import { CoverageFacts } from "./CoverageFacts";
import styles from "./Methods.module.css";

export interface MethodsViewProps {
  /** null = /api/data-status pending: skeleton (UI-11.10). */
  clocks: ThreeClocksModel | null;
  /** null = pending. */
  coverage: CoverageFactsModel | null;
  /** UI-11.11: shown with the API detail and the last valid sample week. */
  failure?: IngestionFailureModel;
  /** Messages for other failed requests, with an optional retry control. */
  loadErrors?: readonly string[];
  retry?: ReactNode;
}

/** Static prose renders immediately; only clocks and facts wait for the API. */
export function MethodsView({ clocks, coverage, failure, loadErrors = [], retry }: MethodsViewProps) {
  return (
    <div className={styles.page}>
      <h1>Behind the mask</h1>
      {failure ? (
        <Notice tone="error" action={retry}>
          <p>
            {ingestionFailure({
              detail: failure.detail,
              lastValidWeek: failure.lastValidWeek ?? THREE_CLOCKS.unavailable,
            })}
          </p>
        </Notice>
      ) : null}
      {loadErrors.map((m) => (
        <Notice key={m} tone="error" action={retry}>
          <p>{m}</p>
        </Notice>
      ))}
      <SourceList />
      <section className={styles.section} aria-labelledby="methods-clocks">
        <h2 id="methods-clocks">{SECTION_HEADINGS.clocks}</h2>
        {clocks === null ? (
          <Skeleton lines={3} />
        ) : (
          <>
            <ThreeClocks clocks={clocks} />
            <p className={styles.mono}>
              {clocks.schemaVersion
                ? schemaVersionLine({ version: clocks.schemaVersion })
                : `Schema version in use: ${THREE_CLOCKS.unavailable}`}
            </p>
            <p className={styles.mono}>
              {clocks.snapshotId
                ? snapshotIdLine({ snapshotId: clocks.snapshotId })
                : `Latest snapshot ID: ${THREE_CLOCKS.unavailable}`}
            </p>
          </>
        )}
      </section>
      <Definitions />
      <CoverageFacts facts={coverage} />
      <LimitsList />
    </div>
  );
}
