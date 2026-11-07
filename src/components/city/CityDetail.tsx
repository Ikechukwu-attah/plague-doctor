"use client";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { Pathogen } from "@/evidence/types";
import { addDaysIso } from "@/evidence/date-utils";
import { useApi } from "@/lib/api/provider";
import { describeApiError } from "@/lib/api/errors";
import { useResource } from "@/lib/hooks/use-resource";
import { useToday } from "@/lib/clock";
import { buildCityView } from "@/lib/view/city-view";
import { buildTimeline } from "@/lib/view/timeline";
import { buildThreeClocks } from "@/lib/view/three-clocks";
import { Chip } from "@/components/design-system/Chip";
import { Button } from "@/components/design-system/Button";
import { Notice } from "@/components/design-system/Notice";
import { Skeleton } from "@/components/design-system/Skeleton";
import { ThreeClocks } from "@/components/design-system/ThreeClocks";
import { VIRUS_LABEL } from "@/ui-copy/levels";
import { LOADING_LABEL, NOT_FOUND, SHOW_ALL_HISTORY, loadFailed, stateAnnouncement } from "@/ui-copy/states";
import { useAnnounceOnChange } from "@/components/design-system/LiveRegionProvider";
import {
  CITY_BACK_TO_MAP,
  CITY_CLOSE,
  CITY_NOT_FOUND_ACTION,
  CITY_VIRUS_CHOOSER_LABEL,
  CITY_VIRUS_LIST_LABEL,
  TIMELINE_LOADING,
  TIMELINE_SHOW_RECENT,
  TIMELINE_WINDOW_ALL,
  TIMELINE_WINDOW_DEFAULT,
  cityDrawerLabel,
  timelineHeading,
} from "@/ui-copy/city";
import { CoverageNotice } from "./CoverageNotice";
import { SitesList } from "./SitesList";
import { TimelineChart, PLOT } from "./TimelineChart";
import { VirusRow } from "./VirusRow";
import styles from "./City.module.css";

export interface CityDetailProps {
  locationId: string;
  variant: "drawer" | "sheet" | "page";
  virus?: Pathogen;
  onClose?: () => void;
}

const VIRUSES: readonly Pathogen[] = ["covid19", "fluA", "fluB", "rsv"];
const DEFAULT_WINDOW_WEEKS = 52;

/** 404 state: the location is not in this snapshot. */
export function CityNotFound(props: { className: string; headingId: string; control: ReactNode }) {
  return (
    <article className={props.className}>
      {props.control}
      <h1 id={props.headingId} className={styles.title}>
        {NOT_FOUND}
      </h1>
      <Link href="/">{CITY_NOT_FOUND_ACTION}</Link>
    </article>
  );
}

export function CityDetail({ locationId, variant, virus: initialVirus, onClose }: CityDetailProps) {
  const { client } = useApi();
  const { now } = useToday();
  const [virus, setVirus] = useState<Pathogen>(initialVirus ?? "covid19");
  const [showRegional, setShowRegional] = useState(false);
  const [allHistory, setAllHistory] = useState(false);

  const status = useResource(`status:${locationId}`, () => client.status({ locationId }), "status");
  const dataStatus = useResource("data-status", () => client.dataStatus(), "data-status");
  const snapshots = useResource("snapshots", () => client.snapshots(), "snapshots");

  const view = useMemo(
    () =>
      status.state === "success"
        ? buildCityView({ status: status.data, envelope: status.envelope, showRegional, today: now })
        : null,
    [status, showRegional, now],
  );

  // History location: the city itself, or the labelled provincial aggregate when shown.
  const aggregateId = status.state === "success" ? (status.data.provinceAggregate?.location.locationId ?? null) : null;
  const historyLocationId =
    view === null
      ? null
      : view.showingRegional
        ? aggregateId
        : view.notice.kind === "no_city_site"
          ? null
          : view.location.locationId;
  const latestWeek = view?.sampleWeek;
  const from = !allHistory && latestWeek ? addDaysIso(latestWeek, -7 * DEFAULT_WINDOW_WEEKS) : undefined;
  const historyKey =
    historyLocationId && latestWeek ? `history:${historyLocationId}:${virus}:${from ?? "all"}` : null;
  const history = useResource(
    historyKey,
    () =>
      client.history({
        locationId: historyLocationId ?? "",
        pathogen: virus,
        ...(from ? { from } : {}),
      }),
    "history",
  );

  useAnnounceOnChange(
    status.state === "error"
      ? status.error.kind === "not_found"
        ? NOT_FOUND
        : loadFailed({ resource: "this location" })
      : view
        ? stateAnnouncement({ what: view.location.locationName })
        : null,
  );

  const headingId = `city-heading-${variant}`;
  // The page route keeps exactly one h1 while loading or failing.
  const pendingHeading =
    variant === "page" ? <h1 className="visually-hidden">{LOADING_LABEL}</h1> : null;
  const place = view?.regionName ?? view?.location.locationName ?? "";
  const containerClass = `${styles.detail} ${styles[variant]}`;

  const closeControl =
    variant === "page" ? (
      <Link href="/" className={styles.backLink}>
        {CITY_BACK_TO_MAP}
      </Link>
    ) : onClose ? (
      <Button onClick={onClose}>{CITY_CLOSE}</Button>
    ) : null;

  if (status.state === "loading" || view === null) {
    if (status.state === "error") {
      if (status.error.kind === "not_found") {
        return <CityNotFound className={containerClass} headingId={headingId} control={closeControl} />;
      }
      const { message, retryLabel } = describeApiError(status.error);
      return (
        <article className={containerClass}>
          {closeControl}
          {pendingHeading}
          <Notice tone="error" action={<Button onClick={status.retry}>{retryLabel}</Button>}>
            {message}
          </Notice>
        </article>
      );
    }
    return (
      <article className={containerClass} aria-busy="true" aria-label={cityDrawerLabel({ place: locationId })}>
        {closeControl}
        {pendingHeading}
        <Skeleton variant="rows" rows={4} />
      </article>
    );
  }

  const clocks =
    dataStatus.state === "success" && snapshots.state === "success"
      ? buildThreeClocks({ dataStatus: dataStatus.data, snapshots: snapshots.data })
      : { sampleWeek: view.sampleWeek };

  const weeks = history.state === "success" ? history.data : [];
  const rowForVirus = view.rows.find((r) => r.pathogen === virus);
  const timeline = buildTimeline({
    weeks,
    markers: rowForVirus && rowForVirus.statement.weekStart ? [rowForVirus.statement] : [],
    virus,
    locationName: place,
    size: PLOT,
  });
  const Heading = variant === "page" ? "h1" : "h2";

  return (
    <article className={containerClass} aria-labelledby={headingId} data-variant={variant}>
      <header className={styles.header}>
        <div>
          <Heading id={headingId} className={styles.title}>
            {view.location.locationName}
          </Heading>
          <p className={styles.muted}>{view.location.province}</p>
        </div>
        {closeControl}
      </header>

      <CoverageNotice
        notice={view.notice}
        showingRegional={view.showingRegional}
        {...(view.regionName ? { regionName: view.regionName } : {})}
        {...(view.notice.kind === "no_city_site" && view.notice.aggregate === "available"
          ? { onToggleRegional: () => setShowRegional((x) => !x) }
          : {})}
      />

      {view.rows.length > 0 ? (
        <section aria-labelledby={`${headingId}-viruses`} className={styles.section}>
          <h2 id={`${headingId}-viruses`} className={styles.sectionTitle}>
            {CITY_VIRUS_LIST_LABEL}
          </h2>
          <ul className={styles.virusList}>
            {view.rows.map((row) => (
              <VirusRow
                key={row.pathogen}
                row={row}
                place={place}
                locationId={historyLocationId ?? view.location.locationId}
                grouping={view.showingRegional ? "province" : view.location.grouping}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {historyKey ? (
        <section aria-labelledby={`${headingId}-timeline`} className={styles.section}>
          <h2 id={`${headingId}-timeline`} className={styles.sectionTitle}>
            {timelineHeading({ virus })}
          </h2>
          <div role="group" aria-label={CITY_VIRUS_CHOOSER_LABEL} className={styles.chips}>
            {VIRUSES.map((p) => (
              <Chip key={p} pressed={p === virus} onClick={() => setVirus(p)}>
                {VIRUS_LABEL[p]}
              </Chip>
            ))}
          </div>
          {history.state === "loading" ? (
            <div aria-busy="true">
              <p className={styles.muted}>{TIMELINE_LOADING}</p>
              <Skeleton variant="card" />
            </div>
          ) : history.state === "error" ? (
            <Notice
              tone="error"
              action={<Button onClick={history.retry}>{describeApiError(history.error).retryLabel}</Button>}
            >
              {describeApiError(history.error).message}
            </Notice>
          ) : (
            <>
              <TimelineChart model={timeline} virus={virus} place={place} />
              <p className={styles.muted}>{allHistory ? TIMELINE_WINDOW_ALL : TIMELINE_WINDOW_DEFAULT}</p>
              <Button onClick={() => setAllHistory((x) => !x)}>
                {allHistory ? TIMELINE_SHOW_RECENT : SHOW_ALL_HISTORY}
              </Button>
            </>
          )}
        </section>
      ) : null}

      <SitesList sites={view.sites} />
      <ThreeClocks clocks={clocks} />
    </article>
  );
}
