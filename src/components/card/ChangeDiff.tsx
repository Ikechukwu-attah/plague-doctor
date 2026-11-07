import type { DiffView } from "@/lib/view/diff-view";
import { CHANGES_HEADING, diffSnapshots, diffWeeks } from "@/ui-copy/card";
import { virusLabel } from "@/ui-copy/levels";
import styles from "./Card.module.css";

/** Revisions and missing data are labelled as such, never as measured change. */
export function ChangeDiff({ view }: { view: DiffView }) {
  return (
    <section className={styles.panel} aria-labelledby="diff-heading">
      <h2 id="diff-heading">{CHANGES_HEADING}</h2>
      {view.message ? <p className={styles.muted}>{view.message}</p> : null}
      <ul className={styles.diffList}>
        {view.lines.map((l) => (
          <li key={l.pathogen} className={styles.diffItem} data-status={l.status}>
            <strong>{virusLabel(l.pathogen)}</strong>: {l.text}
            {l.status !== "unchanged" ? (
              <>
                <div className={styles.muted}>{diffWeeks({ baseline: l.baselineWeek, current: l.newWeek })}</div>
                <div className={styles.mono}>
                  {diffSnapshots({ baseline: l.baselineSnapshotId, current: l.newSnapshotId })}
                </div>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
