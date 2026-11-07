import { EDUCATIONAL_STATEMENT, LIMITS, SECTION_HEADINGS } from "@/ui-copy/methods";
import { FRESHNESS_CONVENTION } from "@/ui-copy/freshness";
import styles from "./Methods.module.css";

/** UI-11.6 limits, UI-11.8 freshness convention (ours, not PHAC's), UI-11.7 non-endorsement. */
export function LimitsList() {
  return (
    <>
      <section className={styles.section} aria-labelledby="methods-limits">
        <h2 id="methods-limits">{SECTION_HEADINGS.limits}</h2>
        <ul className={styles.list}>
          {LIMITS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
      <section className={styles.section} aria-labelledby="methods-freshness">
        <h2 id="methods-freshness">{SECTION_HEADINGS.freshness}</h2>
        <p>{FRESHNESS_CONVENTION}</p>
      </section>
      <section className={styles.section} aria-labelledby="methods-about">
        <h2 id="methods-about">{SECTION_HEADINGS.about}</h2>
        <p>{EDUCATIONAL_STATEMENT}</p>
      </section>
    </>
  );
}
