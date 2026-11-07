"use client";
import { Button } from "@/components/design-system";
import {
  ATTENDEE_CATEGORIES,
  SKIP,
  STEP_HEADINGS,
  WHO_CLEAR,
  WHO_LEGEND,
  WHO_MEMORY_NOTE,
  WHO_PRIVACY_NOTE,
} from "@/ui-copy";
import type { AttendeeCategory } from "@/ui-copy";
import styles from "./Planner.module.css";

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Optional. Categories go to the in-memory store only (UI-8.7). */
export function WhoStep(props: {
  attendees: readonly AttendeeCategory[];
  onToggle(category: AttendeeCategory): void;
  onClear(): void;
  onSkip(): void;
}) {
  const { attendees, onToggle, onClear, onSkip } = props;
  return (
    <>
      <h2 id="planner-step-heading" tabIndex={-1} className={styles.heading}>
        {STEP_HEADINGS.who}
      </h2>
      <p className={styles.help}>{WHO_PRIVACY_NOTE}</p>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{WHO_LEGEND}</legend>
        {ATTENDEE_CATEGORIES.map((c) => (
          <label key={c} className={styles.choice}>
            <input type="checkbox" checked={attendees.includes(c)} onChange={() => onToggle(c)} />
            <span>{capitalise(c)}</span>
          </label>
        ))}
      </fieldset>
      <p className={styles.help}>{WHO_MEMORY_NOTE}</p>
      <div className={styles.actions}>
        <Button onClick={onSkip}>{SKIP}</Button>
        {attendees.length > 0 ? <Button onClick={onClear}>{WHO_CLEAR}</Button> : null}
      </div>
    </>
  );
}
