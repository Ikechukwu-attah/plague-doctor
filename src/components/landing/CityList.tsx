"use client";
import type { MouseEvent } from "react";
import type { LandingRow } from "@/lib/view/landing-rows";
import { LevelBadge } from "@/components/design-system/LevelBadge";
import { TrendGlyph } from "@/components/design-system/TrendGlyph";
import { FreshnessLantern } from "@/components/design-system/FreshnessLantern";
import { NO_MONITORING_SITE } from "@/ui-copy/coverage";
import { RegionalSiteInfo, RegionalSiteLabel } from "@/components/city/RegionalSiteBadge";
import { NO_LOCATIONS, NO_MATCHING_LOCATIONS } from "@/ui-copy/states";
import { weekOf } from "@/ui-copy/timing";
import { CITY_LIST_LABEL, FIND_CITY_LABEL, FIND_CITY_PLACEHOLDER, SEARCHING } from "@/ui-copy/landing";
import { CITY_LIST_ID } from "./landing-ids";
import styles from "./Landing.module.css";

export interface CityRowProps {
  row: LandingRow;
  selected?: boolean;
  onOpen?: (locationId: string) => void;
}

/** One list row: a real link to /city/{id}; a plain left click may be intercepted by onOpen. */
export function CityRow({ row, selected, onOpen }: CityRowProps) {
  const id = row.location.locationId;
  function click(e: MouseEvent<HTMLAnchorElement>) {
    if (!onOpen || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen(id);
  }
  const cls = [styles.row, selected ? styles.rowSelected : "", row.noSite || row.stopped ? styles.rowMuted : ""]
    .filter(Boolean)
    .join(" ");
  const regional = row.location.coverage === "regional_site" ? row.location.regional : undefined;
  return (
    <li {...(regional ? { className: styles.rowItem } : {})}>
      <a
        href={`/city/${encodeURIComponent(id)}`}
        className={cls}
        aria-current={selected ? "true" : undefined}
        data-location-id={id}
        onClick={click}
      >
        <span className={styles.rowName}>{row.location.locationName}</span>
        <span className={styles.rowMeta}>
          {row.noSite ? (
            <span className={styles.noSite}>
              <span className={styles.hatchDot} aria-hidden="true" />
              {NO_MONITORING_SITE}
            </span>
          ) : (
            <>
              <LevelBadge activity={row.badge.kind === "level" ? row.badge.activity : "unknown"} {...(row.badge.kind === "unknown" && row.badge.reason ? { reason: row.badge.reason } : {})} />
              {regional ? <RegionalSiteLabel region={regional.targetName} /> : null}
              {row.badge.kind === "level" ? <TrendGlyph trend={row.trend} /> : null}
              {row.stoppedText ? <span className={styles.rowNote}>{row.stoppedText}</span> : null}
              {row.weekStart ? <span className={`mono ${styles.rowNote}`}>{weekOf(row.weekStart)}</span> : null}
              {row.freshness === "delayed" || row.freshness === "outdated" ? (
                <FreshnessLantern label={row.freshness} />
              ) : null}
            </>
          )}
        </span>
      </a>
      {regional ? <RegionalSiteInfo /> : null}
    </li>
  );
}

export interface CityListProps {
  rows: LandingRow[];
  query: string;
  onQuery: (q: string) => void;
  onOpen?: (locationId: string) => void;
  selectedId?: string;
  searching?: boolean;
}

export function CityList({ rows, query, onQuery, onOpen, selectedId, searching }: CityListProps) {
  return (
    <section id={CITY_LIST_ID} className={styles.list} aria-label={CITY_LIST_LABEL}>
      <label className={styles.searchLabel}>
        {FIND_CITY_LABEL}
        <input
          type="search"
          className={styles.search}
          value={query}
          placeholder={FIND_CITY_PLACEHOLDER}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>
      {searching ? (
        <p role="status" className={styles.rowNote}>
          {SEARCHING}
        </p>
      ) : null}
      {rows.length === 0 ? (
        searching ? null : <p role="status" className={styles.empty}>
          {query.trim() ? NO_MATCHING_LOCATIONS : NO_LOCATIONS}
        </p>
      ) : (
        <ul className={styles.rows}>
          {rows.map((r) => (
            <CityRow key={r.location.locationId} row={r} selected={r.location.locationId === selectedId} {...(onOpen ? { onOpen } : {})} />
          ))}
        </ul>
      )}
    </section>
  );
}
