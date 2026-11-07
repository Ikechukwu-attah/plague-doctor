import type { TimingExplanation } from "@/lib/view/planner";
import {
  TIMING_HEADING,
  TIMING_NEAR_ITEM,
  TIMING_PAST_ITEM,
  TIMING_TOO_EARLY_ITEM,
  daysAway,
} from "@/ui-copy";
import styles from "./Planner.module.css";

/** UI-8.4, 8.5: names the timing rule that will apply; the headline appears only when the date is too far ahead. */
export function TimingExplainer(props: { explanation: TimingExplanation | undefined }) {
  const e = props.explanation;
  const cls = (state: TimingExplanation["state"]) => (e?.state === state ? styles.explainerCurrent : undefined);
  return (
    <section className={styles.explainer} aria-labelledby="planner-timing-heading">
      <h3 id="planner-timing-heading">{TIMING_HEADING}</h3>
      {e ? (
        <p role="status">
          {daysAway({ days: e.daysAway })} {e.headline ?? e.rule}
        </p>
      ) : null}
      <ul>
        <li className={cls("too_early")}>{TIMING_TOO_EARLY_ITEM}</li>
        <li className={cls("near")}>{TIMING_NEAR_ITEM}</li>
        <li className={cls("past")}>{TIMING_PAST_ITEM}</li>
      </ul>
    </section>
  );
}
