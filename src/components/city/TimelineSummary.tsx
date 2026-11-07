import type { TimelineModel } from "@/lib/view/timeline";
import styles from "./City.module.css";

/** Text equivalent of the chart (UI-6.7). */
export function TimelineSummary({ model }: { model: TimelineModel }) {
  return (
    <p className={styles.timelineSummary} data-testid="timeline-summary">
      {model.summary}
    </p>
  );
}
