import type { ReactNode } from "react";
import styles from "./PageContainer.module.css";

export interface PageContainerProps {
  children: ReactNode;
  /** "city" uses a slightly narrower column for the single-column city page. */
  variant?: "default" | "city";
  className?: string;
}

/**
 * Shared centred content column. A plain wrapper: no landmark, so
 * `main#content` stays in the layout.
 */
export function PageContainer({ children, variant = "default", className }: PageContainerProps) {
  const cls = [styles.container, variant === "city" ? styles.city : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} data-variant={variant}>
      {children}
    </div>
  );
}
