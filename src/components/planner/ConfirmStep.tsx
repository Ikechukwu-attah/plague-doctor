"use client";
import { missingSteps, type PlannerState, type PlannerStep } from "@/lib/view/planner";
import { Button } from "@/components/design-system";
import {
  CONFIRM_CAPTION_SETTING,
  CONFIRM_CAPTION_WHEN,
  CONFIRM_CAPTION_WHERE,
  CONFIRM_CAPTION_WHO,
  CONFIRM_WHO_NONE,
  CONFIRM_WHO_SKIPPED,
  CREATE_CARD,
  EDIT,
  STEP_HEADINGS,
  STEP_NAV_LABELS,
  confirmDisabledReason,
  dateLabel,
  settingLabel,
} from "@/ui-copy";
import styles from "./Planner.module.css";

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Row(props: { caption: string; value: string; editLabel: string; onEdit(): void }) {
  return (
    <div className={styles.summaryRow}>
      <dt>{props.caption}</dt>
      <dd>
        <span>{props.value} </span>
        <Button onClick={props.onEdit} aria-label={`${EDIT} ${props.editLabel}`}>
          {EDIT}
        </Button>
      </dd>
    </div>
  );
}

/** UI-8.11: disabled and naming the first missing step until place, date and setting are set. */
export function ConfirmStep(props: {
  state: PlannerState;
  onEdit(step: PlannerStep): void;
  onConfirm(): void;
}) {
  const { state, onEdit, onConfirm } = props;
  const missing = missingSteps(state);
  const first = missing[0];
  const who = state.attendees.length > 0
    ? state.attendees.map(capitalise).join(", ")
    : state.whoSkipped
      ? CONFIRM_WHO_SKIPPED
      : CONFIRM_WHO_NONE;
  return (
    <>
      <h2 id="planner-step-heading" tabIndex={-1} className={styles.heading}>
        {STEP_HEADINGS.confirm}
      </h2>
      <dl className={styles.summary}>
        <Row
          caption={CONFIRM_CAPTION_WHERE}
          value={state.where?.label ?? "-"}
          editLabel={STEP_NAV_LABELS.where}
          onEdit={() => onEdit("where")}
        />
        <Row
          caption={CONFIRM_CAPTION_WHEN}
          value={state.when ? dateLabel({ date: state.when }) : "-"}
          editLabel={STEP_NAV_LABELS.when}
          onEdit={() => onEdit("when")}
        />
        <Row
          caption={CONFIRM_CAPTION_SETTING}
          value={state.venue && state.kind ? settingLabel(state.venue, state.kind) : "-"}
          editLabel={STEP_NAV_LABELS.setting}
          onEdit={() => onEdit("setting")}
        />
        <Row
          caption={CONFIRM_CAPTION_WHO}
          value={who}
          editLabel={STEP_NAV_LABELS.who}
          onEdit={() => onEdit("who")}
        />
      </dl>
      <div className={styles.actions}>
        <Button
          variant="primary"
          disabled={first !== undefined}
          aria-describedby={first !== undefined ? "planner-confirm-reason" : undefined}
          onClick={onConfirm}
        >
          {CREATE_CARD}
        </Button>
      </div>
      {first !== undefined ? (
        <p id="planner-confirm-reason" className={styles.help}>
          {confirmDisabledReason({ missing: STEP_NAV_LABELS[first] })}
        </p>
      ) : null}
    </>
  );
}
