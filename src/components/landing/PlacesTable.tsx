"use client";
import { useId } from "react";
import type { MouseEvent } from "react";
import type { LandingRow } from "@/lib/view/landing-rows";
import { LevelBadge } from "@/components/design-system/LevelBadge";
import { TrendGlyph } from "@/components/design-system/TrendGlyph";
import { FreshnessLantern } from "@/components/design-system/FreshnessLantern";
import { useAnnounce } from "@/components/design-system/LiveRegionProvider";
import { RegionalSiteInfo, RegionalSiteLabel } from "@/components/city/RegionalSiteBadge";
import { NO_MONITORING_SITE } from "@/ui-copy/coverage";
import { weekOf } from "@/ui-copy/timing";
import { NOT_AVAILABLE, PLACES_CAPTION, PLACES_COLUMN_LABEL, PLACES_HEADING, sortedBy } from "@/ui-copy/landing";
import { SORT_KEYS, nextSort, type ListSort, type SortKey } from "@/lib/view/sort-spec";
import { CITY_LIST_ID } from "./landing-ids";
import { PlacesEmpty, PlacesSearch } from "./CityList";
import styles from "./Landing.module.css";

export interface PlacesTableProps {
  /** Already filtered and already ordered by `sort` (see sortRows). */
  rows: LandingRow[];
  sort: ListSort;
  /** Called with the next sort; the owner stores it in the URL (UI-20.21, UI-20.22). */
  onSort: (sort: ListSort) => void;
  query: string;
  onQuery: (q: string) => void;
  onOpen?: (locationId: string) => void;
  selectedId?: string;
  searching?: boolean;
}

/** `aria-sort` for one header: only the active column is ascending or descending (Property 33). */
export function ariaSortFor(sort: ListSort, key: SortKey): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.dir === "asc" ? "ascending" : "descending";
}

/** Empty cell: a dash for sight, "not available" for assistive technology. Missing is never zero. */
function Unavailable() {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="visually-hidden">{NOT_AVAILABLE}</span>
    </>
  );
}

function PlaceRow({ row, selected, onOpen }: { row: LandingRow; selected: boolean; onOpen?: (id: string) => void }) {
  const id = row.location.locationId;
  const name = row.location.locationName;
  const regional = row.location.coverage === "regional_site" ? row.location.regional : undefined;
  const levelKnown = !row.noSite && row.badge.kind === "level";

  function openLink(e: MouseEvent<HTMLAnchorElement>) {
    if (!onOpen || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen(id);
  }
  /* A click anywhere else on the row opens the same drawer; the link and the "i" button handle their own clicks. */
  function openRow(e: MouseEvent<HTMLTableRowElement>) {
    if (!onOpen || e.defaultPrevented) return;
    if ((e.target as HTMLElement).closest("a, button, dialog")) return;
    onOpen(id);
  }

  const cls = [styles.tr, selected ? styles.trSelected : "", row.noSite || row.stopped ? styles.rowMuted : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <tr className={cls} data-place-row={id} onClick={openRow}>
      <td className={styles.tdName}>
        <a
          href={`/city/${encodeURIComponent(id)}`}
          className={styles.nameLink}
          title={name}
          aria-current={selected ? "true" : undefined}
          data-location-id={id}
          onClick={openLink}
        >
          {name}
        </a>
      </td>
      <td className={`${styles.tdClip} ${styles.tdProvince}`} title={row.location.province}>
        {row.location.province}
      </td>
      <td className={styles.tdLevel}>
        <div className={styles.levelWrap}>
        {row.noSite ? (
          <span className={styles.noSite}>
            <span className={styles.hatchDot} aria-hidden="true" />
            {NO_MONITORING_SITE}
          </span>
        ) : (
          <span className={styles.levelCell}>
            <LevelBadge
              activity={row.badge.kind === "level" ? row.badge.activity : "unknown"}
              {...(row.badge.kind === "unknown" && row.badge.reason ? { reason: row.badge.reason } : {})}
            />
            {regional ? <RegionalSiteLabel region={regional.targetName} /> : null}
          </span>
        )}
        {regional ? <RegionalSiteInfo /> : null}
        </div>
      </td>
      <td className={styles.tdClip} title={row.stoppedText}>
        {levelKnown ? (
          <TrendGlyph trend={row.trend} />
        ) : row.stoppedText && !row.noSite ? (
          <span className={styles.rowNote}>{row.stoppedText}</span>
        ) : (
          <Unavailable />
        )}
      </td>
      <td className={`${styles.tdClip} mono`}>
        {row.weekStart && !row.noSite ? weekOf(row.weekStart) : <Unavailable />}
      </td>
      <td className={styles.tdFresh}>
        {row.noSite ? <Unavailable /> : <FreshnessLantern label={row.freshness} />}
      </td>
    </tr>
  );
}

/**
 * "All places" (UI-20.19 to UI-20.28): a real table below the map. Header buttons sort; `aria-sort` follows the
 * sort held in the URL. The table sits in normal page flow: no wrapper scrolls, so the page scrolls (UI-20.24).
 */
export function PlacesTable({ rows, sort, onSort, query, onQuery, onOpen, selectedId, searching }: PlacesTableProps) {
  const headingId = useId();
  const announce = useAnnounce();
  const sortBy = (key: SortKey) => {
    const next = nextSort(sort, key);
    onSort(next);
    announce(sortedBy(next));
  };
  return (
    <section id={CITY_LIST_ID} className={styles.places} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.placesHeading}>
        {PLACES_HEADING}
      </h2>
      <PlacesSearch query={query} onQuery={onQuery} {...(searching ? { searching } : {})} />
      {rows.length === 0 ? (
        <PlacesEmpty query={query} {...(searching ? { searching } : {})} />
      ) : (
        <table className={styles.table} data-places-table="">
          <caption className="visually-hidden">{PLACES_CAPTION}</caption>
          <thead>
            <tr>
              {SORT_KEYS.map((key) => {
                const active = sort.key === key;
                return (
                  <th key={key} scope="col" aria-sort={ariaSortFor(sort, key)} className={styles.th} data-col={key}>
                    <button type="button" className={styles.thButton} onClick={() => sortBy(key)}>
                      {PLACES_COLUMN_LABEL[key]}
                      <span className={styles.sortArrow} aria-hidden="true">
                        {active ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <PlaceRow
                key={r.location.locationId}
                row={r}
                selected={r.location.locationId === selectedId}
                {...(onOpen ? { onOpen } : {})}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
