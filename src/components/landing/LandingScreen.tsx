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
import { DiscontinuedToggle, MapToggle, NoDataToggle, SortControl, ViewSwitch } from "./Controls";
import { sortRows, type ListSort } from "@/lib/view/sort-rows";
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
  /** City list order only; the map keeps its own order. */
  sort?: ListSort;
  onSort?: (sort: ListSort) => void;
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
  return (
    <div className={styles.page}>
      {p.staleWeek ? <StaleBanner week={p.staleWeek} action={p.staleAction} /> : null}
      {p.notices}
      <VirusChips value={p.virus} onChange={p.onVirus} />
      <div className={styles.controls}>
        <DiscontinuedToggle checked={p.showDiscontinued} onChange={p.onDiscontinued} />
        {p.phase === "ready" && showMap && p.onNoData ? (
          <NoDataToggle checked={p.showNoData === true} onChange={p.onNoData} />
        ) : null}
        {p.phase === "ready" ? (
          <>
            {p.onSort ? <SortControl value={p.sort ?? "az"} onChange={p.onSort} /> : null}
            <ViewSwitch view={p.view} count={p.rows.length} onChange={p.onView} />
            <MapToggle mapShown={p.mapShown} onToggle={p.onToggleMap} />
          </>
        ) : null}
      </div>
      {p.phase === "loading" ? (
        showMap && MapComponent ? (
          /* Task 17.14: same grid as the ready state, so the outlines (chunk ready) and then markers (data) fill a reserved panel. */
          <div className={styles.body} data-map="true">
            <div className={styles.mapCol}>
              <MapComponent rows={[]} virus={p.virus} pending onOpen={p.onOpen} />
            </div>
            <div className={styles.mapCol}>
              <Skeleton variant="rows" rows={6} />
            </div>
          </div>
        ) : (
          <Skeleton variant="rows" rows={6} />
        )
      ) : null}
      {p.phase === "error" ? p.errorNotice : null}
      {p.phase === "ready" ? (
        <>
          <div className={styles.body} data-map={showMap ? "true" : "false"}>
            {showMap && MapComponent ? (
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
            ) : null}
            <div className={styles.mapCol}>
              {p.searchError}
              <CityList
                rows={sortRows(p.rows, p.sort ?? "az")}
                query={p.query}
                onQuery={p.onQuery}
                onOpen={p.onOpen}
                {...(p.selectedId ? { selectedId: p.selectedId } : {})}
                {...(p.searching ? { searching: true } : {})}
              />
            </div>
          </div>
          <Legend />
        </>
      ) : null}
      <FreshnessFooter clocks={p.clocks} {...(p.freshness ? { freshness: p.freshness } : {})} />
      {p.detail}
    </div>
  );
}
