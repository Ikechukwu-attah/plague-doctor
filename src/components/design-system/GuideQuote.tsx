import { GUIDE_NAME } from "@/ui-copy/guide";
import styles from "./DesignSystem.module.css";

export interface GuideQuoteModel {
  /** Text produced by a ui-copy guide template. */
  text: string;
}

export function GuideQuote({ quote }: { quote: GuideQuoteModel }) {
  return (
    <figure className={styles.quote}>
      <span className={styles.avatar} aria-hidden="true" />
      <blockquote className={styles.quoteText}>
        {quote.text}
        <cite className={styles.quoteName}>{GUIDE_NAME}</cite>
      </blockquote>
    </figure>
  );
}
