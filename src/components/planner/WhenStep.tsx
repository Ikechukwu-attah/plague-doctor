"use client";
import { useId } from "react";
import { explainTiming } from "@/lib/view/planner";
import { isRealDate } from "@/lib/url-state";
import { Notice } from "@/components/design-system";
import { LATEST_WEEK_UNAVAILABLE, STEP_HEADINGS, WHEN_HELP, WHEN_LABEL } from "@/ui-copy";
import { TimingExplainer } from "./TimingExplainer";
import styles from "./Planner.module.css";

export function WhenStep(props: {
  value: string | undefined;
  today: Date;
  /** Latest sample week for the chosen place, when known. */
  latestWeek?: string;
  latestWeekFailed?: boolean;
  onChange(date: string): void;
}) {
  const { value, today, latestWeek, latestWeekFailed, onChange } = props;
  const id = useId();
  const helpId = useId();
  const explanation = value && isRealDate(value) ? explainTiming(value, today, latestWeek) : undefined;
  return (
    <>
      <h2 id="planner-step-heading" tabIndex={-1} className={styles.heading}>
        {STEP_HEADINGS.when}
      </h2>
      <div>
        <label htmlFor={id} className={styles.fieldLabel}>
          {WHEN_LABEL}
        </label>
        <input
          id={id}
          type="date"
          className={styles.input}
          value={value ?? ""}
          aria-describedby={helpId}
          onChange={(e) => {
            if (isRealDate(e.target.value)) onChange(e.target.value);
          }}
        />
        <p id={helpId} className={styles.help}>
          {WHEN_HELP}
        </p>
      </div>
      {latestWeekFailed ? <Notice tone="caution">{LATEST_WEEK_UNAVAILABLE}</Notice> : null}
      <TimingExplainer explanation={explanation} />
    </>
  );
}
