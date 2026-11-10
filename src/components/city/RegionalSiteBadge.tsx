"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  REGIONAL_SITE_INFO_BODY,
  REGIONAL_SITE_INFO_CLOSE,
  REGIONAL_SITE_INFO_OPEN,
  REGIONAL_SITE_INFO_TITLE,
  REGIONAL_SITE_LABEL,
} from "@/ui-copy/coverage";
import styles from "./City.module.css";

/** Text label only (safe inside a link): "Regional site". The region name is shown by the caller. */
export function RegionalSiteLabel({ region }: { region?: string }) {
  return (
    <span className={styles.regionalLabel} data-regional-label="">
      {REGIONAL_SITE_LABEL}
      {region ? <span className="visually-hidden">{`: ${region}`}</span> : null}
    </span>
  );
}

/** "i" button + native modal dialog explaining catchment versus city boundary. Body mounts only while open. */
export function RegionalSiteInfo() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    }
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.provTrigger}
        aria-haspopup="dialog"
        aria-label={REGIONAL_SITE_INFO_OPEN}
        data-regional-info=""
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">i</span>
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={open ? titleId : undefined}
        onClose={() => {
          setOpen(false);
          triggerRef.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        {open ? (
          <>
            <h2 id={titleId} className={styles.dialogTitle}>
              {REGIONAL_SITE_INFO_TITLE}
            </h2>
            <p className={styles.dialogStatement}>{REGIONAL_SITE_INFO_BODY}</p>
            <button ref={closeRef} type="button" className={styles.dialogClose} onClick={() => dialogRef.current?.close()}>
              {REGIONAL_SITE_INFO_CLOSE}
            </button>
          </>
        ) : null}
      </dialog>
    </>
  );
}

/** Label plus "i", for the City_Page. */
export function RegionalSiteBadge({ region }: { region?: string }) {
  return (
    <span className={styles.regionalBadge}>
      <RegionalSiteLabel {...(region ? { region } : {})} />
      <RegionalSiteInfo />
    </span>
  );
}
