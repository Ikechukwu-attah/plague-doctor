import { DATA_ATTRIBUTION, EDUCATIONAL_STATEMENT } from "@/ui-copy";
import styles from "./Shell.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <p>{EDUCATIONAL_STATEMENT}</p>
        <p data-testid="data-attribution">
          {DATA_ATTRIBUTION.before}
          <a href={DATA_ATTRIBUTION.href} rel="noopener noreferrer">
            {DATA_ATTRIBUTION.linkText}
          </a>
          {DATA_ATTRIBUTION.after}
        </p>
      </div>
    </footer>
  );
}
