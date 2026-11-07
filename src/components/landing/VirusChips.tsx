"use client";
import { useRef } from "react";
import type { KeyboardEvent } from "react";
import type { Pathogen } from "@/evidence/types";
import { VIRUS_LABEL } from "@/ui-copy/levels";
import { VIRUS_GROUP_LABEL } from "@/ui-copy/landing";
import styles from "./Landing.module.css";

export const VIRUS_ORDER: readonly Pathogen[] = ["covid19", "fluA", "fluB", "rsv"];

/** Pure keyboard rule (UI-2.3): arrows wrap, Home/End jump. Returns undefined for other keys. */
export function nextVirus(current: Pathogen, key: string): Pathogen | undefined {
  const i = VIRUS_ORDER.indexOf(current);
  const n = VIRUS_ORDER.length;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return VIRUS_ORDER[(i + 1) % n];
    case "ArrowLeft":
    case "ArrowUp":
      return VIRUS_ORDER[(i - 1 + n) % n];
    case "Home":
      return VIRUS_ORDER[0];
    case "End":
      return VIRUS_ORDER[n - 1];
    default:
      return undefined;
  }
}

export function VirusChips(props: { value: Pathogen; onChange: (virus: Pathogen) => void }) {
  const refs = useRef<Partial<Record<Pathogen, HTMLButtonElement | null>>>({});
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const next = nextVirus(props.value, e.key);
    if (!next) return;
    e.preventDefault();
    props.onChange(next);
    refs.current[next]?.focus();
  }
  return (
    <div role="group" aria-label={VIRUS_GROUP_LABEL} className={styles.chips}>
      {VIRUS_ORDER.map((v) => (
        <button
          key={v}
          type="button"
          ref={(el) => {
            refs.current[v] = el;
          }}
          className={styles.chip}
          aria-pressed={v === props.value}
          onClick={() => props.onChange(v)}
          onKeyDown={onKeyDown}
        >
          {VIRUS_LABEL[v]}
        </button>
      ))}
    </div>
  );
}
