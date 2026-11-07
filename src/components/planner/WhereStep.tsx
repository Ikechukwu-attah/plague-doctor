"use client";
import { useId, useState } from "react";
import type { LocationEntry } from "@/evidence/types";
import type { PlannerState } from "@/lib/view/planner";
import { Button, Notice, Skeleton } from "@/components/design-system";
import {
  KEEP_PLACE_ACTION,
  NO_COVERAGE_CHECKLIST_NOTE,
  NO_MATCHING_LOCATIONS,
  STEP_HEADINGS,
  WHERE_COVERAGE_CITY,
  WHERE_COVERAGE_NATIONAL,
  WHERE_COVERAGE_PROVINCE,
  WHERE_COVERAGE_SITE_ONLY,
  WHERE_LIST_LABEL,
  WHERE_SEARCH_HELP,
  WHERE_SEARCH_LABEL,
  NO_MONITORING_SITE,
  noAggregate,
  noCitySite,
  noCoverageHeading,
  provincialAggregateNotice,
  regionalLabel,
  aggregateAction,
  whereSelected,
} from "@/ui-copy";
import styles from "./Planner.module.css";

export type LocationsView =
  | { state: "loading" }
  | { state: "error"; message: string; retryLabel: string; onRetry(): void }
  | { state: "success"; locations: readonly LocationEntry[] };

export type Where = NonNullable<PlannerState["where"]>;

function coverageWord(c: LocationEntry["coverage"]): string {
  switch (c) {
    case "city_site":
      return WHERE_COVERAGE_CITY;
    case "site_only":
      return WHERE_COVERAGE_SITE_ONLY;
    case "no_city_site":
      return NO_MONITORING_SITE;
    case "province_aggregate":
      return WHERE_COVERAGE_PROVINCE;
    case "national":
      return WHERE_COVERAGE_NATIONAL;
  }
}

export function toWhere(l: LocationEntry): Where {
  return { locationId: l.locationId, label: l.locationName, coverage: l.coverage };
}

/** Pure filter: places a gathering can be planned in (sites roll up under their city). */
export function filterPlaces(all: readonly LocationEntry[], query: string): LocationEntry[] {
  const q = query.trim().toLowerCase();
  return all
    .filter((l) => l.grouping !== "site")
    .filter(
      (l) =>
        q === "" ||
        l.locationName.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.province.toLowerCase().includes(q),
    );
}

export function WhereStep(props: {
  locations: LocationsView;
  selected: Where | undefined;
  onSelect(where: Where): void;
  onContinue(): void;
}) {
  const { locations, selected, onSelect, onContinue } = props;
  const [query, setQuery] = useState("");
  const searchId = useId();
  const helpId = useId();

  return (
    <>
      <h2 id="planner-step-heading" tabIndex={-1} className={styles.heading}>
        {STEP_HEADINGS.where}
      </h2>
      {locations.state === "loading" ? <Skeleton variant="rows" rows={5} /> : null}
      {locations.state === "error" ? (
        <Notice
          tone="error"
          action={
            <Button onClick={locations.onRetry}>{locations.retryLabel}</Button>
          }
        >
          {locations.message}
        </Notice>
      ) : null}
      {selected ? <p aria-live="polite">{whereSelected({ place: selected.label })}</p> : null}
      {locations.state === "success" ? (
        <WhereList
          all={locations.locations}
          query={query}
          onQuery={setQuery}
          searchId={searchId}
          helpId={helpId}
          selected={selected}
          onSelect={onSelect}
          onContinue={onContinue}
        />
      ) : null}
    </>
  );
}

function WhereList(props: {
  all: readonly LocationEntry[];
  query: string;
  onQuery(q: string): void;
  searchId: string;
  helpId: string;
  selected: Where | undefined;
  onSelect(where: Where): void;
  onContinue(): void;
}) {
  const { all, query, onQuery, searchId, helpId, selected, onSelect, onContinue } = props;
  const places = filterPlaces(all, query);
  const chosen = selected ? all.find((l) => l.locationId === selected.locationId) : undefined;
  return (
    <>
      <div>
        <label htmlFor={searchId} className={styles.fieldLabel}>
          {WHERE_SEARCH_LABEL}
        </label>
        <input
          id={searchId}
          type="search"
          className={styles.input}
          value={query}
          aria-describedby={props.helpId}
          autoComplete="off"
          onChange={(e) => onQuery(e.target.value)}
        />
        <p id={helpId} className={styles.help}>
          {WHERE_SEARCH_HELP}
        </p>
      </div>
      {places.length === 0 ? (
        <p role="status">{NO_MATCHING_LOCATIONS}</p>
      ) : (
        <ul className={styles.list} aria-label={WHERE_LIST_LABEL}>
          {places.map((l) => (
            <li key={l.locationId}>
              <button
                type="button"
                className={styles.option}
                aria-pressed={selected?.locationId === l.locationId}
                onClick={() => onSelect(toWhere(l))}
              >
                <span>
                  {l.locationName}
                  <span className={styles.optionMeta}>
                    {l.province && l.province !== l.locationName ? ` · ${l.province}` : ""}
                  </span>
                </span>
                <span className={styles.optionMeta}>{coverageWord(l.coverage)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {chosen && chosen.coverage === "no_city_site" ? (
        <NoCoverage place={chosen} onSelect={onSelect} onContinue={onContinue} />
      ) : null}
    </>
  );
}

/** UI-8.10: explain the gap, offer PHAC's labelled provincial aggregate, keep a path to the checklist. */
function NoCoverage(props: {
  place: LocationEntry;
  onSelect(where: Where): void;
  onContinue(): void;
}) {
  const { place, onSelect, onContinue } = props;
  const agg = place.provinceAggregate;
  return (
    <Notice tone="caution">
      <p>
        <strong>{noCoverageHeading({ place: place.locationName })}</strong>
      </p>
      <p>{noCitySite({ place: place.locationName })}</p>
      {agg ? (
        <>
          <p>{provincialAggregateNotice({ place: place.locationName, region: agg.province || agg.locationName })}</p>
          <p className={styles.help}>{regionalLabel({ region: agg.province || agg.locationName })}</p>
          <div className={styles.actions}>
            <Button onClick={() => onSelect(toWhere(agg))}>
              {aggregateAction({ region: agg.province || agg.locationName })}
            </Button>
            <Button onClick={onContinue}>{KEEP_PLACE_ACTION}</Button>
          </div>
        </>
      ) : (
        <>
          <p>{noAggregate({ place: place.locationName })}</p>
          <div className={styles.actions}>
            <Button onClick={onContinue}>{KEEP_PLACE_ACTION}</Button>
          </div>
        </>
      )}
      <p className={styles.help}>{NO_COVERAGE_CHECKLIST_NOTE}</p>
    </Notice>
  );
}
