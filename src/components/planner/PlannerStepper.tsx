"use client";
import { useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/api/provider";
import { describeApiError } from "@/lib/api/errors";
import { useResource } from "@/lib/hooks/use-resource";
import { useToday } from "@/lib/clock";
import { toTorontoDateString } from "@/evidence/date-utils";
import { clearAttendees, getAttendees, setAttendees } from "@/lib/attendees-memory";
import {
  PLANNER_STEP_ORDER,
  buildCardUrl,
  initialPlannerState,
  missingSteps,
  plannerReducer,
  type PlannerState,
  type PlannerStep,
} from "@/lib/view/planner";
import { Button } from "@/components/design-system";
import { useAnnounceOnChange } from "@/components/design-system/LiveRegionProvider";
import { loadFailed, stateAnnouncement } from "@/ui-copy/states";
import {
  BACK,
  NEXT,
  PLANNER_STEPS_LABEL,
  STEP_CURRENT,
  STEP_DONE,
  STEP_LOCKED,
  STEP_NAV_LABELS,
  type AttendeeCategory,
} from "@/ui-copy";
import { ConfirmStep } from "./ConfirmStep";
import { SettingStep } from "./SettingStep";
import { WhenStep } from "./WhenStep";
import { WhereStep, type LocationsView } from "./WhereStep";
import { WhoStep } from "./WhoStep";
import { canAdvance, canEnterStep, isStepComplete } from "./step-access";
import { stepSummary } from "./step-summary";
import styles from "./Planner.module.css";

function init(): PlannerState {
  // Attendee choices survive client-side navigation (module memory), never reloads.
  return { ...initialPlannerState, attendees: getAttendees() };
}

export function PlannerStepper() {
  const router = useRouter();
  const { client } = useApi();
  const { now } = useToday();
  const [state, dispatch] = useReducer(plannerReducer, undefined, init);

  const locations = useResource("locations:all", () => client.locations(), "locations");
  const whereId = state.where?.locationId;
  const status = useResource(
    whereId && state.step !== "where" ? `status:${whereId}` : null,
    () => client.status({ locationId: whereId ?? "" }),
    "status",
  );

  useAnnounceOnChange(
    locations.state === "error"
      ? loadFailed({ resource: "locations" })
      : locations.state === "success"
        ? stateAnnouncement({ what: "Locations" })
        : null,
  );

  // Move focus to the new step heading (keyboard and screen-reader users).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById("planner-step-heading")?.focus();
  }, [state.step]);

  const locationsView: LocationsView =
    locations.state === "success"
      ? { state: "success", locations: locations.data }
      : locations.state === "error"
        ? { state: "error", ...describeApiError(locations.error), onRetry: locations.retry }
        : { state: "loading" };

  const latestWeek =
    status.state === "success"
      ? status.data.observations.map((o) => o.weekStart).sort().at(-1)
      : undefined;

  function toggleAttendee(category: AttendeeCategory) {
    dispatch({ type: "toggleAttendee", category });
    // Mirror into the in-memory store only; no URL, storage or request.
    const next = getAttendees().includes(category)
      ? getAttendees().filter((c) => c !== category)
      : [...getAttendees(), category];
    setAttendees(next);
  }

  function confirm() {
    if (missingSteps(state).length > 0) return;
    const { where, when, venue, kind } = state;
    if (!where || !when || !venue || !kind) return;
    router.push(buildCardUrl({ locationId: where.locationId, eventDate: when, venue, kind }));
  }

  return (
    <div className={styles.layout}>
      <nav aria-label={PLANNER_STEPS_LABEL}>
        <ol className={styles.rail}>
          {PLANNER_STEP_ORDER.map((step, i) => {
            const enterable = canEnterStep(state, step);
            const current = state.step === step;
            const done = isStepComplete(state, step);
            const summary = stepSummary(state, step, now);
            return (
              <li key={step}>
                <button
                  type="button"
                  className={styles.railItem}
                  disabled={!enterable}
                  aria-current={current ? "step" : undefined}
                  onClick={() => dispatch({ type: "goto", step })}
                >
                  <span className={styles.railMark} data-done={done ? "true" : undefined} aria-hidden="true">
                    {done ? "\u2713" : i + 1}
                  </span>
                  <span className={styles.railText}>
                    <span className={styles.railLabel}>{STEP_NAV_LABELS[step]}</span>
                    {summary !== undefined ? <span className={styles.railSummary}>{summary}</span> : null}
                  </span>
                  <span className="visually-hidden">
                    {current ? STEP_CURRENT : done ? STEP_DONE : !enterable ? STEP_LOCKED : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <section className={styles.panel} aria-labelledby="planner-step-heading">
        <StepBody
          state={state}
          dispatch={dispatch}
          locations={locationsView}
          today={now}
          latestWeek={latestWeek}
          latestWeekFailed={status.state === "error"}
          onToggleAttendee={toggleAttendee}
          onConfirm={confirm}
        />
        {state.step !== "confirm" ? (
          <div className={styles.actions}>
            {state.step !== "where" ? (
              <Button onClick={() => dispatch({ type: "back" })}>{BACK}</Button>
            ) : null}
            <Button variant="primary" disabled={!canAdvance(state)} onClick={() => dispatch({ type: "next" })}>
              {NEXT}
            </Button>
          </div>
        ) : (
          <div className={styles.actions}>
            <Button onClick={() => dispatch({ type: "back" })}>{BACK}</Button>
          </div>
        )}
      </section>
    </div>
  );
}

function StepBody(props: {
  state: PlannerState;
  dispatch: (a: Parameters<typeof plannerReducer>[1]) => void;
  locations: LocationsView;
  today: Date;
  latestWeek: string | undefined;
  latestWeekFailed: boolean;
  onToggleAttendee: (c: AttendeeCategory) => void;
  onConfirm: () => void;
}) {
  const { state, dispatch } = props;
  const goto = (step: PlannerStep) => dispatch({ type: "goto", step });
  switch (state.step) {
    case "where":
      return (
        <WhereStep
          locations={props.locations}
          selected={state.where}
          onSelect={(where) => dispatch({ type: "setWhere", where })}
          onContinue={() => dispatch({ type: "next" })}
        />
      );
    case "when":
      return (
        <WhenStep
          value={state.when}
          today={props.today}
          {...(props.latestWeek !== undefined ? { latestWeek: props.latestWeek } : {})}
          latestWeekFailed={props.latestWeekFailed}
          onChange={(date) => dispatch({ type: "setWhen", date, today: toTorontoDateString(props.today) })}
        />
      );
    case "setting":
      return (
        <SettingStep
          venue={state.venue}
          kind={state.kind}
          onChange={(venue, kind) => {
            if (venue && kind) dispatch({ type: "setSetting", venue, kind });
          }}
        />
      );
    case "who":
      return (
        <WhoStep
          attendees={state.attendees}
          onToggle={props.onToggleAttendee}
          onClear={() => {
            for (const c of state.attendees) dispatch({ type: "toggleAttendee", category: c });
            clearAttendees();
          }}
          onSkip={() => {
            clearAttendees();
            dispatch({ type: "skipWho" });
          }}
        />
      );
    case "confirm":
      return <ConfirmStep state={state} onEdit={goto} onConfirm={props.onConfirm} />;
  }
}
