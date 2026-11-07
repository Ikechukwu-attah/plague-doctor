import type { CardView } from "@/lib/view/card-view";
import { formatDisplayDate } from "@/evidence/date-utils";
import {
  ATTENDEES_ON_SCREEN_NOTE,
  HISTORICAL_BAND_NOTE,
  OMEN_CARD_LABEL,
  SOURCE_LINE,
  caveatSentence,
  createdAt,
  notDetectedNote,
} from "@/ui-copy/card";
import { Notice } from "@/components/design-system";
import { ChecklistBlock } from "./ChecklistBlock";
import { HistoricalStatementRow } from "./HistoricalStatementRow";
import { VirusStatementRow } from "./VirusStatementRow";
import styles from "./Card.module.css";

/** The parchment card. Pure markup from a CardView; the caveat is always present. */
export function OmenCard({ view }: { view: CardView }) {
  const { header } = view;
  const showsNotDetected =
    view.timing === "near" && view.rows.some((r) => r.badge.kind === "level" && r.badge.activity === "not_detected");
  return (
    <article className={styles.paper} aria-label={OMEN_CARD_LABEL} data-timing={view.timing}>
      <div>
        <div className={styles.eyebrow}>{OMEN_CARD_LABEL}</div>
        <h1 className={styles.title}>{header.title}</h1>
        <div className={styles.meta}>
          {header.place} · <span>{formatDisplayDate(header.eventDate)}</span> · {header.setting}
        </div>
      </div>

      {view.timing === "near" ? (
        <>
          <div className={styles.strip}>{view.observedStrip}</div>
          {view.regionalNotice ? <Notice tone="info">{view.regionalNotice}</Notice> : null}
          {view.missingDataNotice ? <Notice tone="caution">{view.missingDataNotice}</Notice> : null}
          <ul className={styles.rows}>
            {view.rows.map((r) => (
              <VirusStatementRow key={r.pathogen} row={r} />
            ))}
          </ul>
        </>
      ) : (
        <>
          {view.timing === "too_early" ? (
            <>
              <h2 className={styles.headline}>{view.headline}</h2>
              <p className={styles.note}>{view.sentence}</p>
            </>
          ) : null}
          <ul className={styles.rows}>
            {view.rows.map((r) => (
              <HistoricalStatementRow key={r.pathogen} row={r} place={header.place} />
            ))}
          </ul>
          <p className={styles.note}>{HISTORICAL_BAND_NOTE}</p>
        </>
      )}

      <p className={styles.note}>{caveatSentence()}</p>
      {showsNotDetected ? <p className={styles.note}>{notDetectedNote()}</p> : null}

      {header.attendeeChips.length > 0 ? (
        <div>
          <ul className={styles.chips}>
            {header.attendeeChips.map((c) => (
              <li key={c} className={styles.chip}>
                {c}
              </li>
            ))}
          </ul>
          <p className={styles.source}>{ATTENDEES_ON_SCREEN_NOTE}</p>
        </div>
      ) : null}

      <ChecklistBlock />

      <div className={styles.footer}>
        <span>
          {header.sourceUrl ? (
            <a href={header.sourceUrl} rel="noreferrer">
              {SOURCE_LINE}
            </a>
          ) : (
            SOURCE_LINE
          )}
        </span>
        <span>
          {header.snapshotId ? `snapshot ${header.snapshotId.slice(0, 12)} · ` : ""}
          {createdAt({ date: header.createdAt.slice(0, 10) })}
        </span>
      </div>
    </article>
  );
}
