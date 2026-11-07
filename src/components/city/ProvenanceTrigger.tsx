"use client";
import { useId, useRef } from "react";
import type { ProvenanceModel } from "@/lib/view/provenance";
import { PROVENANCE_CLOSE, PROVENANCE_OPEN, provenanceOpenFor } from "@/ui-copy/city";
import { ProvenanceDialogBody } from "./ProvenanceDialog";
import styles from "./City.module.css";

/**
 * Button + native modal <dialog>. Escape closes (native cancel), and focus
 * returns to the trigger when the dialog closes (UI-7.3, UI-7.5).
 */
export function ProvenanceTrigger({ model }: { model: ProvenanceModel }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.provTrigger}
        aria-haspopup="dialog"
        aria-label={provenanceOpenFor({ statement: model.statement })}
        onClick={() => dialogRef.current?.showModal()}
      >
        <span aria-hidden="true" data-prov-glyph="">i</span>
        <span className="visually-hidden">{PROVENANCE_OPEN}</span>
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClose={() => triggerRef.current?.focus()}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <ProvenanceDialogBody model={model} titleId={titleId} />
        <button type="button" className={styles.dialogClose} onClick={() => dialogRef.current?.close()} autoFocus>
          {PROVENANCE_CLOSE}
        </button>
      </dialog>
    </>
  );
}
