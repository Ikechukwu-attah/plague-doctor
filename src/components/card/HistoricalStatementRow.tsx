import type { HistoricalRowView } from "@/lib/view/card-view";
import { historicalBand, historicalGap, historicalMeasured } from "@/ui-copy/card";
import styles from "./Card.module.css";

/** Past observations only. Never a level, never an "as of" statement. */
export function HistoricalStatementRow({ row, place }: { row: HistoricalRowView; place: string }) {
  const measured =
    row.wAvg != null && row.weekStart
      ? historicalMeasured({ virus: row.pathogen, place, week: row.weekStart, wAvg: row.wAvg })
      : row.wAvg === undefined
        ? null
        : historicalGap({ virus: row.pathogen, place });
  return (
    <li className={styles.histRow} data-pathogen={row.pathogen} data-gap={row.gap ? "true" : "false"}>
      {measured ? <p className={styles.note}>{measured}</p> : null}
      <p className={styles.note}>
        {historicalBand({ virus: row.pathogen, place, min: row.histMin, max: row.histMax })}
      </p>
    </li>
  );
}
