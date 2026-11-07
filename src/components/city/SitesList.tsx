import Link from "next/link";
import { CITY_SITES_HEADING, CITY_SITES_NOTE } from "@/ui-copy/city";
import styles from "./City.module.css";

export function SitesList({ sites }: { sites: Array<{ locationId: string; locationName: string }> }) {
  if (sites.length === 0) return null;
  return (
    <section aria-labelledby="city-sites-heading" className={styles.section}>
      <h2 id="city-sites-heading" className={styles.sectionTitle}>
        {CITY_SITES_HEADING}
      </h2>
      <p className={styles.muted}>{CITY_SITES_NOTE}</p>
      <ul className={styles.siteList}>
        {sites.map((s) => (
          <li key={s.locationId}>
            <Link href={`/city/${encodeURIComponent(s.locationId)}`}>{s.locationName}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
