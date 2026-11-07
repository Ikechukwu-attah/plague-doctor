import type { ButtonHTMLAttributes } from "react";
import styles from "./DesignSystem.module.css";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: "primary" | "secondary";
}

export function Button({ variant = "secondary", type = "button", ...rest }: ButtonProps) {
  const cls = variant === "primary" ? `${styles.button} ${styles.primary}` : styles.button;
  return <button type={type} className={cls} {...rest} />;
}
