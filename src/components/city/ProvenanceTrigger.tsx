"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { ProvenanceModel } from "@/lib/view/provenance";
import { PROVENANCE_CLOSE, PROVENANCE_OPEN, provenanceOpenFor } from "@/ui-copy/city";
import { ProvenanceDialogBody } from "./ProvenanceDialog";
import styles from "./City.module.css";

/**
 * Button + native modal <dialog>. The body is mounted only while open, so a
 * closed dialog adds nothing to the DOM. Escape closes (native cancel), and
 * focus returns to the trigger when the dialog closes (UI-7.3, UI-7.5).
 */
export function ProvenanceTrigger({ model, explain = false }: { model: ProvenanceModel; explain?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  // Content exists once `open` is true; only then open the native modal.
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
        aria-label={provenanceOpenFor({ statement: model.statement })}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true" data-prov-glyph="">i</span>
        <span className="visually-hidden">{PROVENANCE_OPEN}</span>
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
            <ProvenanceDialogBody model={model} titleId={titleId} explain={explain} />
            <button ref={closeRef} type="button" className={styles.dialogClose} onClick={() => dialogRef.current?.close()}>
              {PROVENANCE_CLOSE}
            </button>
          </>
        ) : null}
      </dialog>
    </>
  );
}
