"use client";
import { useState } from "react";
import { Button } from "@/components/design-system";
import { useAnnounce } from "@/components/design-system/LiveRegionProvider";
import {
  COPIED_CONFIRMATION,
  COPY_FAILED,
  COPY_SHARE_TEXT,
  NO_ATTENDEES_IN_SHARE,
  SHARE_DATED_SNAPSHOT,
  SHARE_HEADING,
  SHARE_TEXT_FIELD_LABEL,
} from "@/ui-copy/card";
import styles from "./Card.module.css";

/** Shows exactly `text` (generateShareText output) and copies that same string. */
export function ShareTextPanel({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const announce = useAnnounce();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      announce(COPIED_CONFIRMATION);
    } catch {
      setState("failed");
      announce(COPY_FAILED);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="share-heading">
      <h2 id="share-heading">{SHARE_HEADING}</h2>
      <p className={styles.muted}>{SHARE_DATED_SNAPSHOT}</p>
      <pre className={styles.pre}>{text}</pre>
      <p className={styles.muted}>{NO_ATTENDEES_IN_SHARE}</p>
      <div className={styles.actions}>
        <Button variant="primary" onClick={() => void copy()}>
          {COPY_SHARE_TEXT}
        </Button>
      </div>
      {state === "copied" ? <p className={styles.muted}>{COPIED_CONFIRMATION}</p> : null}
      {state === "failed" ? (
        <div>
          <p className={styles.muted}>{COPY_FAILED}</p>
          <textarea
            className={styles.textarea}
            readOnly
            value={text}
            aria-label={SHARE_TEXT_FIELD_LABEL}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ) : null}
    </section>
  );
}
