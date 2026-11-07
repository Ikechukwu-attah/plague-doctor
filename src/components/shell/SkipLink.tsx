import { SKIP_TO_CONTENT } from "@/ui-copy";
import styles from "./Shell.module.css";

export function SkipLink() {
  return (
    <a className={styles.skip} href="#content">
      {SKIP_TO_CONTENT}
    </a>
  );
}
