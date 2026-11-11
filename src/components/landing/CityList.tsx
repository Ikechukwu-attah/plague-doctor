"use client";
import { useId } from "react";
import type { MouseEvent } from "react";
import type { LandingRow } from "@/lib/view/landing-rows";
import { LevelBadge } from "@/components/design-system/LevelBadge";
import { TrendGlyph } from "@/components/design-system/TrendGlyph";
import { FreshnessLantern } from "@/components/design-system/FreshnessLantern";
import { NO_MONITORING_SITE } from "@/ui-copy/coverage";
import { RegionalSiteInfo, RegionalSiteLabel } from "@/components/city/RegionalSiteBadge";
import { NO_LOCATIONS, NO_MATCHING_LOCATIONS } from "@/ui-copy/states";
import { weekOf } from "@/ui-copy/timing";
import { FIND_CITY_LABEL, FIND_CITY_PLACEHOLDER, PLACES_HEADING, SEARCHING } from "@/ui-copy/landing";
import { CITY_LIST_ID } from "./landing-ids";
import styles from "./Landing.module.css";

export interface CityRowProps {
  row: LandingRow;
  selected?: boolean;
  onOpen?: (locationId: string) => void;
}

/**
 * One phone row (UI-20.28): a real link to /city/{id}; a plain left click may be intercepted by onOpen.
 * Grid layout: line 1 is the name with the status badge right-aligned; line 2 is the trend and the
 * "week of" date, left-aligned under the name.
 */
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
  const hasSub =
    !row.noSite &&
    (row.badge.kind === "level" ||
      Boolean(row.stoppedText) ||
      Boolean(row.weekStart) ||
      row.freshness === "delayed" ||
      row.freshness === "outdated");
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
        <span className={styles.rowBadge}>
          {row.noSite ? (
            <span className={styles.noSite}>
              <span className={styles.hatchDot} aria-hidden="true" />
              {NO_MONITORING_SITE}
            </span>
          ) : (
            <>
              <LevelBadge activity={row.badge.kind === "level" ? row.badge.activity : "unknown"} {...(row.badge.kind === "unknown" && row.badge.reason ? { reason: row.badge.reason } : {})} />
              {regional ? <RegionalSiteLabel region={regional.targetName} /> : null}
            </>
          )}
        </span>
        {hasSub ? (
          <span className={styles.rowSub}>
            {row.badge.kind === "level" ? <TrendGlyph trend={row.trend} /> : null}
            {row.stoppedText ? <span className={styles.rowNote}>{row.stoppedText}</span> : null}
            {row.weekStart ? <span className={`mono ${styles.rowNote}`}>{weekOf(row.weekStart)}</span> : null}
            {row.freshness === "delayed" || row.freshness === "outdated" ? (
              <FreshnessLantern label={row.freshness} />
            ) : null}
          </span>
        ) : null}
      </a>
      {regional ? <RegionalSiteInfo /> : null}
    </li>
  );
}

/** The search box and its status line, shared by the table and the phone list. */
export function PlacesSearch(props: { query: string; onQuery: (q: string) => void; searching?: boolean }) {
  return (
    <>
      <label className={styles.searchLabel}>
        {FIND_CITY_LABEL}
        <input
          type="search"
          className={styles.search}
          value={props.query}
          placeholder={FIND_CITY_PLACEHOLDER}
          onChange={(e) => props.onQuery(e.target.value)}
        />
      </label>
      {props.searching ? (
        <p role="status" className={styles.rowNote}>
          {SEARCHING}
        </p>
      ) : null}
    </>
  );
}

/** Empty-result message; null while a search is still running. */
export function PlacesEmpty(props: { query: string; searching?: boolean }) {
  if (props.searching) return null;
  return (
    <p role="status" className={styles.empty}>
      {props.query.trim() ? NO_MATCHING_LOCATIONS : NO_LOCATIONS}
    </p>
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

/** Stacked list: the phone rendering (below 768 px) of the "All places" section. */
export function CityList({ rows, query, onQuery, onOpen, selectedId, searching }: CityListProps) {
  const headingId = useId();
  return (
    <section id={CITY_LIST_ID} className={styles.list} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.placesHeading}>
        {PLACES_HEADING}
      </h2>
      <PlacesSearch query={query} onQuery={onQuery} {...(searching ? { searching } : {})} />
      {rows.length === 0 ? (
        <PlacesEmpty query={query} {...(searching ? { searching } : {})} />
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
