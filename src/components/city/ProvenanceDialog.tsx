import type { ProvenanceModel } from "@/lib/view/provenance";
import { PROVENANCE_ATTRIBUTION, PROVENANCE_FIELDS, PROVENANCE_TITLE } from "@/ui-copy/city";
import { topicsForField } from "@/ui-copy/status-explanations";
import { StatusTopics } from "./StatusExplainer";
import styles from "./City.module.css";

/** Dialog body: every provenance field, IDs in monospace, classifications attributed to PHAC. */
export function ProvenanceDialogBody({
  model,
  titleId,
  explain = false,
}: {
  model: ProvenanceModel;
  titleId: string;
  /** City page only: append the "About this status" topics for this field (UI-19.20). */
  explain?: boolean;
}) {
  return (
    <>
      <h2 id={titleId} className={styles.dialogTitle}>
        {PROVENANCE_TITLE}
      </h2>
      <p className={styles.dialogStatement}>{model.statement}</p>
      <dl className={styles.provList}>
        <dt>{PROVENANCE_FIELDS.field}</dt>
        <dd className={styles.mono}>{model.field}</dd>
        <dt>{PROVENANCE_FIELDS.snapshotId}</dt>
        <dd className={styles.mono}>{model.snapshotId}</dd>
        <dt>{PROVENANCE_FIELDS.locationId}</dt>
        <dd className={styles.mono}>{model.locationId}</dd>
        <dt>{PROVENANCE_FIELDS.grouping}</dt>
        <dd className={styles.mono}>{model.grouping}</dd>
        <dt>{PROVENANCE_FIELDS.ruleId}</dt>
        <dd className={styles.mono}>{model.ruleId}</dd>
        <dt>{PROVENANCE_FIELDS.interpretation}</dt>
        <dd>{model.interpretationText}</dd>
        <dt>{PROVENANCE_FIELDS.source}</dt>
        <dd>
          <a href={model.sourceUrl} rel="noreferrer" className={styles.mono}>
            {model.sourceUrl}
          </a>
        </dd>
      </dl>
      {explain ? <StatusTopics topics={topicsForField(model.field)} level="h3" /> : null}
      <p className={styles.dialogNote}>{PROVENANCE_ATTRIBUTION}</p>
    </>
  );
}
