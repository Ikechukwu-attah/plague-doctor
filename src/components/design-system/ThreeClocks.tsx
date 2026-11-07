import type { ThreeClocksModel } from "@/lib/view/three-clocks";
import { formatDisplayDate, toTorontoDateString } from "@/evidence/date-utils";
import { weekOf } from "@/ui-copy/timing";
import { THREE_CLOCKS } from "@/ui-copy/states";
import styles from "./DesignSystem.module.css";

function dateOnly(value: string | undefined): string | undefined {
  if (!value || Number.isNaN(Date.parse(value))) return undefined;
  return formatDisplayDate(toTorontoDateString(value));
}

/** Three separate clocks: the sample week, PHAC's file update, and our own ingest. */
export function ThreeClocks({ clocks }: { clocks: ThreeClocksModel }) {
  const rows: Array<[string, string | undefined]> = [
    [THREE_CLOCKS.sampleWeek, clocks.sampleWeek ? weekOf(clocks.sampleWeek) : undefined],
    [THREE_CLOCKS.phacFileUpdated, dateOnly(clocks.phacFileUpdated)],
    [THREE_CLOCKS.lastIngest, dateOnly(clocks.ourLastIngest)],
  ];
  return (
    <dl className={styles.clocks}>
      {rows.map(([term, value]) => (
        <div key={term} className={styles.clock}>
          <dt>{term}</dt>
          <dd>{value ?? THREE_CLOCKS.unavailable}</dd>
        </div>
      ))}
    </dl>
  );
}
