"use client";
import { SHOW_DISCONTINUED } from "@/ui-copy/coverage";
import { HIDE_MAP, SHOW_MAP } from "@/ui-copy/states";
import {
  SORT_ACTIVITY,
  SORT_AZ,
  SORT_LABEL,
  SHOW_NO_DATA_PLACES,
  browseAsList,
  sortAnnouncement,
} from "@/ui-copy/landing";
import { useAnnounce } from "@/components/design-system/LiveRegionProvider";
import type { ListSort } from "@/lib/view/sort-rows";
import styles from "./Landing.module.css";

/** Map only; off by default (UI-19.18). The city list is unaffected. */
export function NoDataToggle(props: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      {SHOW_NO_DATA_PLACES}
    </label>
  );
}

/** Off by default (UI-4.5). */
export function DiscontinuedToggle(props: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      {SHOW_DISCONTINUED}
    </label>
  );
}

/** Below 640 px the list is the default; the map is opt-in (UI-3.11). Hidden at 640 px and up. */
export function MapToggle(props: { mapShown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.mapToggle} ${styles.mobileOnly}`}
      aria-pressed={props.mapShown}
      onClick={props.onToggle}
    >
      {props.mapShown ? HIDE_MAP : SHOW_MAP}
    </button>
  );
}

/** City list order. Default A–Z; the choice lives in the URL (UI-19.15). Does not affect the map. */
export function SortControl(props: { value: ListSort; onChange: (sort: ListSort) => void }) {
  const announce = useAnnounce();
  return (
    <label className={styles.sortLabel}>
      {SORT_LABEL}
      <select
        className={styles.sortSelect}
        value={props.value}
        onChange={(e) => {
          const v: ListSort = e.target.value === "activity" ? "activity" : "az";
          props.onChange(v);
          announce(sortAnnouncement({ sort: v }));
        }}
      >
        <option value="az">{SORT_AZ}</option>
        <option value="activity">{SORT_ACTIVITY}</option>
      </select>
    </label>
  );
}

/** Desktop map/list switch. Hidden below 640 px. */
export function ViewSwitch(props: { view: "map" | "list"; count: number; onChange: (view: "map" | "list") => void }) {
  const list = props.view === "list";
  return (
    <button
      type="button"
      className={`${styles.chip} ${styles.desktopOnly}`}
      aria-pressed={list}
      onClick={() => props.onChange(list ? "map" : "list")}
    >
      {browseAsList({ count: props.count })}
    </button>
  );
}
