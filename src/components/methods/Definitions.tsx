import { AGGREGATE_COVERAGE_RULE } from "@/ui-copy/coverage";
import {
  HISTORY_BAND_EXPLAINER,
  MISSING_VS_ZERO,
  NA1_DEFINITION,
  NA2_DEFINITION,
  SECTION_HEADINGS,
  TWO_CLASSIFICATIONS,
} from "@/ui-copy/methods";
import styles from "./Methods.module.css";

/** UI-11.3, 11.4, 11.5: NA1/NA2, coverage thresholds, the two classifications. */
export function Definitions() {
  return (
    <section className={styles.section} aria-labelledby="methods-definitions">
      <h2 id="methods-definitions">{SECTION_HEADINGS.definitions}</h2>
      <p>{TWO_CLASSIFICATIONS}</p>
      <ul className={styles.list}>
        <li>{NA1_DEFINITION}</li>
        <li>{NA2_DEFINITION}</li>
      </ul>
      <p>{AGGREGATE_COVERAGE_RULE}</p>
      <p>{MISSING_VS_ZERO}</p>
      <p>{HISTORY_BAND_EXPLAINER}</p>
    </section>
  );
}
