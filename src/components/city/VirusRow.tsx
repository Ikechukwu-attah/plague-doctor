import type { CityVirusRow } from "@/lib/view/city-view";
import { provenanceFor } from "@/lib/view/provenance";
import type { StatusObservation } from "@/evidence/types";
import { LevelBadge } from "@/components/design-system/LevelBadge";
import { TrendGlyph } from "@/components/design-system/TrendGlyph";
import { FreshnessLantern } from "@/components/design-system/FreshnessLantern";
import { Notice } from "@/components/design-system/Notice";
import { virusLabel } from "@/ui-copy/levels";
import { ageText, DELAYED_CAUTION, OUTDATED_HISTORY_ONLY } from "@/ui-copy/freshness";
import { HISTORY_ONLY } from "@/ui-copy/states";
import { CITY_HEADLINE_LABEL, CITY_SIGNAL_LABEL, CITY_TREND_LABEL, cityObservedLine } from "@/ui-copy/city";
import { ProvenanceTrigger } from "./ProvenanceTrigger";
import styles from "./City.module.css";

export interface VirusRowProps {
  row: CityVirusRow;
  /** Name of the place the values describe (the city, or the labelled region). */
  place: string;
  locationId: string;
  grouping: StatusObservation["grouping"];
}

/** One virus: PHAC headline level, separately labelled signal level, trend, freshness. */
export function VirusRow({ row, place, locationId, grouping }: VirusRowProps) {
  const ctx = { locationId, grouping, locationName: place };
  const s = row.statement;
  return (
    <li className={styles.virusRow} data-pathogen={row.pathogen} data-freshness={s.freshnessLabel}>
      <h3 className={styles.virusName}>{virusLabel(row.pathogen)}</h3>
      <dl className={styles.virusFields}>
        <div className={styles.field}>
          <dt>{CITY_HEADLINE_LABEL}</dt>
          <dd>
            <LevelBadge activity={s.activityIndex} {...(s.unknownReason ? { reason: s.unknownReason } : {})} size="md" />
            <ProvenanceTrigger model={provenanceFor(s, "Viral_Activity_Level", ctx)} explain />
          </dd>
        </div>
        <div className={styles.field}>
          <dt>{CITY_SIGNAL_LABEL}</dt>
          <dd>
            <LevelBadge activity={s.signalLevel} />
            <ProvenanceTrigger model={provenanceFor(s, "latestLevel", ctx)} explain />
          </dd>
        </div>
        <div className={styles.field}>
          <dt>{CITY_TREND_LABEL}</dt>
          <dd>
            <TrendGlyph trend={s.trend} />
            <ProvenanceTrigger model={provenanceFor(s, "latestTrend", ctx)} explain />
          </dd>
        </div>
      </dl>
      {row.unknownText ? <p className={styles.muted}>{row.unknownText}</p> : null}
      {s.weekStart ? (
        <p className={styles.observed}>
          <span className={styles.mono}>{cityObservedLine({ week: s.weekStart })}</span>
          <ProvenanceTrigger model={provenanceFor(s, "weekStart", ctx)} explain />
          {row.ageDays !== undefined ? <span className={styles.muted}>{ageText({ days: row.ageDays })}</span> : null}
        </p>
      ) : null}
      <FreshnessLantern label={s.freshnessLabel} />
      {row.outdated ? (
        <p className={styles.historyOnly}>
          <strong>{HISTORY_ONLY}</strong> {OUTDATED_HISTORY_ONLY}
        </p>
      ) : null}
      {row.delayed ? <Notice tone="caution">{DELAYED_CAUTION}</Notice> : null}
    </li>
  );
}
