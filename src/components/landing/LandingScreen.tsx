import type { ComponentType, ReactNode } from "react";
import type { CanadaMapProps } from "./CanadaMap";
import type { Pathogen } from "@/evidence/types";
import type { FreshnessLabel } from "@/evidence/card-types";
import type { LandingRow } from "@/lib/view/landing-rows";
import type { ThreeClocksModel } from "@/lib/view/three-clocks";
import { Skeleton } from "@/components/design-system/Skeleton";
import { VirusChips } from "./VirusChips";
import { CityList } from "./CityList";
import { Legend } from "./Legend";
import { StaleBanner } from "./StaleBanner";
import { FreshnessFooter } from "./FreshnessFooter";
import { PlacesTable } from "./PlacesTable";
import { DiscontinuedToggle, MapToggle, NoDataToggle, ViewSwitch } from "./Controls";
import { DEFAULT_SORT, sortRows, type ListSort } from "@/lib/view/sort-rows";
import styles from "./Landing.module.css";

export interface LandingScreenProps {
  virus: Pathogen;
  onVirus: (virus: Pathogen) => void;
  /** loading: skeleton only. error: nothing but `errorNotice` (UI-2.11). ready: full page. */
  phase: "loading" | "error" | "ready";
  errorNotice?: ReactNode;
  /** Non-blocking notices (e.g. clocks failed to load). */
  notices?: ReactNode;
  staleWeek?: string;
  staleAction?: ReactNode;
  rows: LandingRow[];
  query: string;
  onQuery: (q: string) => void;
  searching?: boolean;
  searchError?: ReactNode;
  /** Places order only (from the URL); the map keeps its own order. Default City A–Z. */
  sort?: ListSort;
  onSort?: (sort: ListSort) => void;
  /** True at 768 px and up: render the Places_Table; below that, the stacked phone list (UI-20.25, UI-20.28). */
  table?: boolean;
  showDiscontinued: boolean;
  onDiscontinued: (checked: boolean) => void;
  /** Map-only: draw markers for places without data (UI-19.18). Default off. */
  showNoData?: boolean;
  onNoData?: (checked: boolean) => void;
  /** True at 640 px and up. */
  wide: boolean;
  view: "map" | "list";
  onView: (view: "map" | "list") => void;
  /** Mobile-only "Show map" state. */
  mapShown: boolean;
  onToggleMap: () => void;
  selectedId?: string;
  onOpen: (locationId: string) => void;
  week?: string;
  clocks: ThreeClocksModel;
  freshness?: FreshnessLabel;
  detail?: ReactNode;
  /**
   * The map component. Injected so the route can code-split it (SVG outlines, fog and markers
   * are not needed for the first paint, and the mobile layout hides them by default).
   */
  mapComponent?: ComponentType<CanadaMapProps>;
}

/** Presentational landing page: every state (loading, error, stale, empty, success) is a prop combination. */
export function LandingScreen(p: LandingScreenProps) {
  const showMap = p.wide ? p.view === "map" : p.mapShown;
  const MapComponent = p.mapComponent;
  const sort = p.sort ?? DEFAULT_SORT;
  return (
    <div className={styles.page}>
      {p.staleWeek ? <StaleBanner week={p.staleWeek} action={p.staleAction} /> : null}
      {p.notices}
      {/* UI-20.29, UI-20.30: one container, one row at 1024 px and up, wrapping cleanly below. DOM order: chips, discontinued, no-data (map only), browse as list. */}
      <div className={styles.controls} data-controls-row="">
        <VirusChips value={p.virus} onChange={p.onVirus} />
        <DiscontinuedToggle checked={p.showDiscontinued} onChange={p.onDiscontinued} />
        {p.phase === "ready" && showMap && p.onNoData ? (
          <NoDataToggle checked={p.showNoData === true} onChange={p.onNoData} />
        ) : null}
        {p.phase === "ready" ? (
          <>
            <ViewSwitch view={p.view} count={p.rows.length} onChange={p.onView} />
            <MapToggle mapShown={p.mapShown} onToggle={p.onToggleMap} />
          </>
        ) : null}
      </div>
      {p.phase === "loading" ? (
        showMap && MapComponent ? (
          /* Task 17.14: same single column as the ready state, so the outlines (chunk ready) and then markers (data) fill a reserved panel. */
          <div className={styles.body} data-map="true">
            <div className={styles.mapCol}>
              <MapComponent rows={[]} virus={p.virus} pending onOpen={p.onOpen} />
            </div>
            <Skeleton variant="rows" rows={6} />
          </div>
        ) : (
          <Skeleton variant="rows" rows={6} />
        )
      ) : null}
      {p.phase === "error" ? p.errorNotice : null}
      {p.phase === "ready" ? (
        <>
          {/* UI-20.18: the map spans the full content width; the places list or table follows below it. */}
          {showMap && MapComponent ? (
            <div className={styles.body} data-map="true">
              <div className={styles.mapCol}>
                <MapComponent
                  rows={p.rows}
                  virus={p.virus}
                  showNoData={p.showNoData === true}
                  {...(p.week ? { week: p.week } : {})}
                  {...(p.selectedId ? { selectedId: p.selectedId } : {})}
                  onOpen={p.onOpen}
                />
              </div>
            </div>
          ) : null}
          <Legend />
          {p.searchError}
          {/* Property 33: the order comes from the URL sort; tables sort from their headers, the phone list follows the URL only. */}
          {p.table ? (
            <PlacesTable
              rows={sortRows(p.rows, sort)}
              sort={sort}
              onSort={p.onSort ?? (() => {})}
              query={p.query}
              onQuery={p.onQuery}
              onOpen={p.onOpen}
              {...(p.selectedId ? { selectedId: p.selectedId } : {})}
              {...(p.searching ? { searching: true } : {})}
            />
          ) : (
            <CityList
              rows={sortRows(p.rows, sort)}
              query={p.query}
              onQuery={p.onQuery}
              onOpen={p.onOpen}
              {...(p.selectedId ? { selectedId: p.selectedId } : {})}
              {...(p.searching ? { searching: true } : {})}
            />
          )}
        </>
      ) : null}
      <FreshnessFooter clocks={p.clocks} {...(p.freshness ? { freshness: p.freshness } : {})} />
      {p.detail}
    </div>
  );
}
