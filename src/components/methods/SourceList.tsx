import { METHODS_SOURCES, SECTION_HEADINGS } from "@/ui-copy/methods";
import styles from "./Methods.module.css";

/** UI-11.1: PHAC sources as links. */
export function SourceList() {
  return (
    <section className={styles.section} aria-labelledby="methods-sources">
      <h2 id="methods-sources">{SECTION_HEADINGS.sources}</h2>
      <ul className={styles.links}>
        {METHODS_SOURCES.map((s) => (
          <li key={s.url}>
            <a href={s.url} rel="noopener noreferrer">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
