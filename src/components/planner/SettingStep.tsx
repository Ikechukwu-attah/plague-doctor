"use client";
import { useState } from "react";
import { KINDS, SETTING_KIND_LEGEND, SETTING_VENUE_LEGEND, STEP_HEADINGS, VENUES } from "@/ui-copy";
import type { KindId, VenueId } from "@/ui-copy";
import styles from "./Planner.module.css";

/** Two fixed lists, radio groups only. No free text (UI-8.3). */
export function SettingStep(props: {
  venue: VenueId | undefined;
  kind: KindId | undefined;
  onChange(venue: VenueId | undefined, kind: KindId | undefined): void;
}) {
  const { onChange } = props;
  // A half-made choice is kept locally; the plan is only updated once both lists are chosen.
  const [venue, setVenue] = useState<VenueId | undefined>(props.venue);
  const [kind, setKind] = useState<KindId | undefined>(props.kind);
  return (
    <>
      <h2 id="planner-step-heading" tabIndex={-1} className={styles.heading}>
        {STEP_HEADINGS.setting}
      </h2>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{SETTING_VENUE_LEGEND}</legend>
        {VENUES.map((v) => (
          <label key={v.id} className={styles.choice}>
            <input
              type="radio"
              name="planner-venue"
              value={v.id}
              checked={venue === v.id}
              onChange={() => {
                setVenue(v.id);
                onChange(v.id, kind);
              }}
            />
            <span>{v.label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{SETTING_KIND_LEGEND}</legend>
        {KINDS.map((k) => (
          <label key={k.id} className={styles.choice}>
            <input
              type="radio"
              name="planner-kind"
              value={k.id}
              checked={kind === k.id}
              onChange={() => {
                setKind(k.id);
                onChange(venue, k.id);
              }}
            />
            <span>{k.label}</span>
          </label>
        ))}
      </fieldset>
    </>
  );
}
