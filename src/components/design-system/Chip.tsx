import type { ReactNode } from "react";
import styles from "./DesignSystem.module.css";

export function Chip(props: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={styles.chip} aria-pressed={props.pressed} onClick={props.onClick}>
      {props.children}
    </button>
  );
}
