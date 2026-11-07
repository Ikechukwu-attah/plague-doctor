"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buildCard } from "@/evidence/card";
import { classifyTiming } from "@/evidence/timing";
import { generateShareText } from "@/evidence/share";
import type { EventCard } from "@/evidence/card-types";
import type { MeasuredWeek, Pathogen } from "@/evidence/types";
import { useApi } from "@/lib/api/provider";
import { describeApiError } from "@/lib/api/errors";
import { useClock, useToday } from "@/lib/clock";
import { useAttendees } from "@/lib/attendees-memory";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useResource } from "@/lib/hooks/use-resource";
import { createSavedEvents } from "@/lib/storage/saved-events";
import { buildCardView } from "@/lib/view/card-view";
import { buildDiffView } from "@/lib/view/diff-view";
import { parseCardUrl, parseSavedCardUrl } from "@/lib/url-state";
import { Button, Notice } from "@/components/design-system";
import { useAnnounceOnChange } from "@/components/design-system/LiveRegionProvider";
import { CardLoading } from "./CardLoading";
import {
  CARD_LINK_INVALID,
  EDIT_GATHERING,
  HIDE_CHANGES,
  NO_NEWER_SNAPSHOT,
  OMEN_CARD_LABEL,
  SAVED_NOT_FOUND,
  SEE_WHAT_CHANGED,
  baselineOnly,
} from "@/ui-copy/card";
import { NOT_FOUND, loadFailed, stateAnnouncement } from "@/ui-copy/states";
import { PLAN_A_GATHERING } from "@/ui-copy/landing";
import { ChangeDiff } from "./ChangeDiff";
import { ChecklistBlock } from "./ChecklistBlock";
import { OmenCard } from "./OmenCard";
import { SavedEventsPanel } from "./SavedEventsPanel";
import { ShareTextPanel } from "./ShareTextPanel";
import styles from "./Card.module.css";

const PATHOGENS: readonly Pathogen[] = ["covid19", "fluA", "fluB", "rsv"];

export function Problem(props: { children: string; retry?: () => void; retryLabel?: string }) {
  return (
    <div className={styles.main}>
      <h1 className={styles.headline}>{OMEN_CARD_LABEL}</h1>
      <Notice
        tone="error"
        action={
          props.retry ? <Button onClick={props.retry}>{props.retryLabel ?? ""}</Button> : undefined
        }
      >
        {props.children}
      </Notice>
      <div className={styles.actions}>
        <Link className={styles.linkButton} href="/plan">
          {PLAN_A_GATHERING}
        </Link>
      </div>
      <ChecklistBlock />
    </div>
  );
}

/** Client-side Omen Card: fetch PHAC data, run buildCard in the browser, render. */
export function CardScreen() {
  const query = useSearchParams().toString();
  const { client } = useApi();
  const { now } = useToday();
  const clock = useClock();
  const hydrated = useHydrated();
  const memoryAttendees = useAttendees();
  const [showDiff, setShowDiff] = useState(false);

  const savedId = useMemo(() => parseSavedCardUrl(query), [query]);
  const params = useMemo(() => (savedId ? null : parseCardUrl(query)), [query, savedId]);

  const store = useMemo(() => {
    if (!hydrated) return null;
    try {
      return createSavedEvents(window.localStorage);
    } catch {
      return null;
    }
  }, [hydrated]);

  const savedRecord = useMemo(() => {
    if (!store || !savedId) return null;
    return store.list().records.find((r) => r.id === savedId) ?? null;
  }, [store, savedId]);
  const baseline: EventCard | null = useMemo(
    () => (store && savedRecord ? store.toEventCard(savedRecord) : null),
    [store, savedRecord],
  );

  const target = useMemo(() => {
    if (baseline) {
      return {
        locationId: baseline.locationId,
        eventDate: baseline.eventDate,
        setting: baseline.setting,
        attendees: baseline.attendeeCategories,
      };
    }
    if (params) {
      return {
        locationId: params.locationId,
        eventDate: params.eventDate,
        setting: `${params.venue}.${params.kind}`,
        attendees: [...memoryAttendees],
      };
    }
    return null;
  }, [baseline, params, memoryAttendees]);

  const needsHistory = target ? classifyTiming(target.eventDate, now) !== "near" : false;
  const locationId = target?.locationId ?? "";

  const status = useResource(
    target ? `status:${locationId}` : null,
    () => client.status({ locationId }),
    "status",
  );
  const history = useResource<MeasuredWeek[]>(
    target && needsHistory ? `card-history:${locationId}` : null,
    async () => {
      const results = await Promise.all(
        PATHOGENS.map((pathogen) => client.history({ locationId, pathogen })),
      );
      const first = results[0];
      return {
        data: results.flatMap((r) => r.data),
        envelope: first
          ? first.envelope
          : { snapshotId: "", sampleWeek: "", sourceUrl: "" },
      };
    },
    "history",
  );

  const current: EventCard | null = useMemo(() => {
    if (!target || status.state !== "success") return null;
    if (needsHistory && history.state !== "success") return null;
    const loc = status.data.location;
    const own = status.data.observations.filter((o) => o.locationId === loc.locationId);
    const agg = status.data.provinceAggregate;
    const aggObs = agg
      ? agg.observations.filter((o) => o.locationId === agg.location.locationId)
      : [];
    return buildCard(
      {
        locationId: loc.locationId,
        eventDate: target.eventDate,
        setting: target.setting,
        attendeeCategories: [...target.attendees],
        createdAt: now.toISOString(),
        today: now,
      },
      {
        observations: [...own, ...aggObs],
        history: history.state === "success" ? history.data : [],
        locationEntry: loc,
      },
    );
  }, [target, status, history, needsHistory, now]);

  useAnnounceOnChange(
    status.state === "error" || history.state === "error"
      ? loadFailed({ resource: "Omen Card data" })
      : current
        ? stateAnnouncement({ what: "Omen Card" })
        : null,
  );

  // Invalid link / unknown saved event.
  if (!savedId && !params) return <Problem>{CARD_LINK_INVALID}</Problem>;
  if (savedId && !hydrated) return <CardLoading />;
  if (savedId && !baseline) return <Problem>{SAVED_NOT_FOUND}</Problem>;

  const failure =
    status.state === "error" ? status.error : history.state === "error" ? history.error : null;
  const display = current ?? baseline;

  if (!display) {
    if (failure) {
      if (failure.kind === "not_found") return <Problem>{NOT_FOUND}</Problem>;
      const msg = describeApiError(failure);
      const retry = status.state === "error" ? status.retry : history.retry;
      return (
        <Problem retry={retry} retryLabel={msg.retryLabel}>
          {msg.message}
        </Problem>
      );
    }
    return <CardLoading />;
  }

  const view = buildCardView(display, now);
  const diff = baseline && current ? buildDiffView(baseline, current) : null;
  const noNewer = !!baseline && !!current && baseline.snapshotId === current.snapshotId;

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        {!current && baseline ? (
          <Notice tone="caution">
            {baselineOnly({ snapshotId: baseline.snapshotId, createdAt: baseline.createdAt })}
          </Notice>
        ) : null}
        <OmenCard view={view} />
        <div className={styles.actions}>
          {params ? (
            <Link className={styles.linkButton} href="/plan">
              {EDIT_GATHERING}
            </Link>
          ) : null}
          {baseline && current ? (
            <Button disabled={noNewer} onClick={() => setShowDiff((v) => !v)}>
              {showDiff ? HIDE_CHANGES : SEE_WHAT_CHANGED}
            </Button>
          ) : null}
        </div>
        {noNewer ? <p className={styles.muted}>{NO_NEWER_SNAPSHOT}</p> : null}
      </div>
      <aside className={styles.aside}>
        <ShareTextPanel text={generateShareText(display)} />
        {showDiff && diff ? <ChangeDiff view={diff} /> : null}
        {hydrated ? (
          <SavedEventsPanel
            store={store}
            card={savedId ? null : current}
            now={() => clock.now()}
          />
        ) : null}
      </aside>
    </div>
  );
}
