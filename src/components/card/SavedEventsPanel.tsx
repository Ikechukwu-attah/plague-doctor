"use client";
import { useCallback, useEffect, useState } from "react";
import type { EventCard } from "@/evidence/card-types";
import type { SavedEventsApi } from "@/lib/storage/saved-events";
import type { SavedEventRecord } from "@/lib/storage/saved-event-schema";
import { serializeSavedCardUrl } from "@/lib/url-state";
import { Button } from "@/components/design-system";
import { useAnnounce } from "@/components/design-system/LiveRegionProvider";
import {
  DELETE_ALL_SAVED,
  DELETE_SAVED,
  KEEP_ATTENDEES,
  OPEN_SAVED,
  SAVED_CONFIRMATION,
  SAVED_HEADING,
  SAVED_NONE,
  SAVED_UNAVAILABLE,
  SAVED_UNREADABLE,
  SAVE_FAILED,
  SAVE_TO_DEVICE,
  savedItemTitle,
  savedOn,
} from "@/ui-copy/card";
import styles from "./Card.module.css";

export interface SavedEventsPanelProps {
  /** Null until storage is reachable (or when it is not). */
  store: SavedEventsApi | null;
  /** The card on screen; null when there is nothing to save (e.g. baseline-only view). */
  card: EventCard | null;
  now: () => Date;
}

/** Writes only when the user clicks "Save to this device" (UI-10.1). */
export function SavedEventsPanel({ store, card, now }: SavedEventsPanelProps) {
  const [records, setRecords] = useState<SavedEventRecord[]>([]);
  const [unreadable, setUnreadable] = useState<Array<{ index: number }>>([]);
  const [keepAttendees, setKeepAttendees] = useState(false);
  const [failed, setFailed] = useState(false);
  const announce = useAnnounce();

  const refresh = useCallback(() => {
    if (!store) return;
    const l = store.list();
    setRecords(l.records);
    setUnreadable(l.unreadable);
  }, [store]);

  useEffect(refresh, [refresh]);

  function save() {
    if (!store || !card) {
      setFailed(true);
      return;
    }
    const res = store.save(card, { keepAttendees }, now());
    if (res.ok) {
      setFailed(false);
      announce(SAVED_CONFIRMATION);
      refresh();
    } else {
      setFailed(true);
      announce(SAVE_FAILED);
    }
  }

  const hasAttendees = !!card && card.attendeeCategories.length > 0;
  const empty = records.length === 0 && unreadable.length === 0;

  return (
    <section className={styles.panel} aria-labelledby="saved-heading">
      <h2 id="saved-heading">{SAVED_HEADING}</h2>
      {!store ? <p className={styles.muted}>{SAVED_UNAVAILABLE}</p> : null}
      {hasAttendees ? (
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={keepAttendees}
            onChange={(e) => setKeepAttendees(e.target.checked)}
          />
          {KEEP_ATTENDEES}
        </label>
      ) : null}
      <div className={styles.actions}>
        <Button onClick={save} disabled={!card}>
          {SAVE_TO_DEVICE}
        </Button>
      </div>
      {failed ? (
        <p className={styles.muted} role="alert">
          {SAVE_FAILED}
        </p>
      ) : null}

      {store && empty ? <p className={styles.muted}>{SAVED_NONE}</p> : null}
      <ul className={styles.savedList}>
        {records.map((r) => (
          <li key={r.id} className={styles.savedItem}>
            <span>
              {savedItemTitle({ place: r.card.locationName, date: r.card.eventDate })}
              <span className={styles.mono}> {savedOn({ date: r.savedAt.slice(0, 10) })}</span>
            </span>
            <span className={styles.actions}>
              <a className={styles.linkButton} href={serializeSavedCardUrl(r.id)}>
                {OPEN_SAVED}
              </a>
              <Button
                onClick={() => {
                  store?.remove(r.id);
                  refresh();
                }}
              >
                {DELETE_SAVED}
              </Button>
            </span>
          </li>
        ))}
        {unreadable.map((u) => (
          <li key={`bad-${u.index}`} className={styles.savedItem}>
            <span>{SAVED_UNREADABLE}</span>
            <Button
              onClick={() => {
                store?.removeUnreadable(u.index);
                refresh();
              }}
            >
              {DELETE_SAVED}
            </Button>
          </li>
        ))}
      </ul>
      {!empty ? (
        <div className={styles.actions}>
          <Button
            onClick={() => {
              store?.removeAll();
              refresh();
            }}
          >
            {DELETE_ALL_SAVED}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
