import type { ReactNode } from "react";
import styles from "./DesignSystem.module.css";

export interface NoticeProps {
  tone: "info" | "caution" | "error";
  children: ReactNode;
  action?: ReactNode;
}

const ICON = { info: "i", caution: "!", error: "x" } as const;

export function Notice({ tone, children, action }: NoticeProps) {
  const toneClass = tone === "caution" ? styles.noticeCaution : tone === "error" ? styles.noticeError : "";
  return (
    <div className={`${styles.notice} ${toneClass}`} role={tone === "error" ? "alert" : "status"} data-tone={tone}>
      <span className={styles.noticeIcon} aria-hidden="true">
        {ICON[tone]}
      </span>
      <div className={styles.noticeBody}>{children}</div>
      {action ?? null}
    </div>
  );
}
