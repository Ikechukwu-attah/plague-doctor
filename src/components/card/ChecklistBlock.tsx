import { PREVENTION_CHECKLIST } from "@/evidence/copy/checklist";
import { CHECKLIST_HEADING, checklistSource } from "@/ui-copy/card";
import styles from "./Card.module.css";

/** PHAC checklist, verbatim from the evidence module. */
export function ChecklistBlock() {
  return (
    <section className={styles.checklist} aria-labelledby="checklist-heading">
      <h2 id="checklist-heading">{CHECKLIST_HEADING}</h2>
      <ul>
        {PREVENTION_CHECKLIST.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className={styles.source}>
        <a href={PREVENTION_CHECKLIST.sourceUrl} rel="noreferrer">
          {checklistSource({ reviewedOn: PREVENTION_CHECKLIST.reviewedOn })}
        </a>
      </p>
    </section>
  );
}
