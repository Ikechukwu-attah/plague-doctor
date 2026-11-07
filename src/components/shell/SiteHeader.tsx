import Link from "next/link";
import { NavLinks } from "./NavLinks";
import styles from "./Shell.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        <svg
          width="34"
          height="34"
          viewBox="0 0 34 34"
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="#F2B544"
          strokeWidth="1.8"
          strokeLinejoin="round"
        >
          <path d="M6 13c0-5 4-9 9-9s8 4 8 8l9 9-11-2c-1 4-4 7-8 7-4 0-7-4-7-9z" />
          <circle cx="13" cy="12" r="2.4" />
        </svg>
        <span className={styles.brandName}>Plague Doctor</span>
      </Link>
      <NavLinks />
    </header>
  );
}
