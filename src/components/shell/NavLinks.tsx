"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/ui-copy";
import styles from "./Shell.module.css";

const ITEMS = [
  { href: "/", label: NAV.map },
  { href: "/plan", label: NAV.plan },
  { href: "/methods", label: NAV.methods },
] as const;

/** "Map" is current on / and on city pages, which open from the map. */
function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/city/");
  if (href === "/plan") return pathname === "/plan" || pathname === "/card";
  return pathname === href;
}

export function NavLinks() {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Main" className={styles.nav}>
      {ITEMS.map((item) => {
        const current = isCurrent(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={current ? `${styles.navLink} ${styles.navLinkCurrent}` : styles.navLink}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
