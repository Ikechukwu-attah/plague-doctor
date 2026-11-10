import {
  STATUS_EXPLAINER_SOURCE_LABEL,
  STATUS_EXPLAINER_SOURCE_URL,
  STATUS_EXPLAINER_TITLE,
  STATUS_TOPICS,
  type StatusTopic,
} from "@/ui-copy/status-explanations";
import styles from "./City.module.css";

/** Topic list shared by the city-page explainer and the provenance dialog. */
export function StatusTopics({ topics, level }: { topics: readonly StatusTopic[]; level: "h3" | "h4" }) {
  const Heading = level;
  return (
    <>
      {topics.map((t) => (
        <section key={t.id} data-topic={t.id} className={styles.topic}>
          <Heading className={styles.topicHeading}>{t.heading}</Heading>
          {t.body.map((p) => (
            <p key={p} className={styles.topicText}>
              {p}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}

/** "About this status": all five topics, reachable from the city page. */
export function StatusExplainer() {
  return (
    <details className={styles.explainer} data-testid="status-explainer">
      <summary>{STATUS_EXPLAINER_TITLE}</summary>
      <StatusTopics topics={STATUS_TOPICS} level="h3" />
      {STATUS_EXPLAINER_SOURCE_URL ? (
        <p className={styles.topicText}>
          <a href={STATUS_EXPLAINER_SOURCE_URL} rel="noreferrer">
            {STATUS_EXPLAINER_SOURCE_LABEL}
          </a>
        </p>
      ) : null}
    </details>
  );
}
