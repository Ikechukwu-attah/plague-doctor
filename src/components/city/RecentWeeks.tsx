import type { RecentWeeksModel } from "./recent-weeks";
import { RECENT_WEEKS_HEADING, RECENT_WEEKS_NOTE } from "@/ui-copy/status-explanations";
import styles from "./City.module.css";

/** Last PHAC weeks, oldest first. Missing weeks are explicit gaps, never filled. */
export function RecentWeeks({ model }: { model: RecentWeeksModel }) {
  if (model.entries.length === 0) return null;
  return (
    <div data-testid="recent-weeks">
      <h3 className={styles.topicHeading}>{RECENT_WEEKS_HEADING}</h3>
      <p className={styles.muted}>{model.summary}</p>
      <ol className={styles.weekStrip}>
        {model.entries.map((e) => (
          <li key={e.weekStart} className={styles.weekCell} data-week={e.weekStart} data-status={e.status}>
            {e.label}
          </li>
        ))}
      </ol>
      <p className={styles.muted}>{RECENT_WEEKS_NOTE}</p>
    </div>
  );
}
