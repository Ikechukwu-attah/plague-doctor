import { EDUCATIONAL_STATEMENT } from "@/ui-copy";
import styles from "./Shell.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <p>{EDUCATIONAL_STATEMENT}</p>
      </div>
    </footer>
  );
}
