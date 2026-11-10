import { LevelBadge, TrendGlyph } from "@/components/design-system";
import { ProvenanceTrigger } from "@/components/city/ProvenanceTrigger";
import type { NearRowView } from "@/lib/view/card-view";
import type { Direction } from "@/evidence/types";
import { cardVoiceLine } from "@/ui-copy/card";
import { virusLabel } from "@/ui-copy/levels";
import { weekOf } from "@/ui-copy/timing";
import styles from "./Card.module.css";

const DIRECTION_BY_WORD: Record<NearRowView["trend"]["word"], Direction> = {
  Increasing: "increasing",
  Stable: "stable",
  Decreasing: "decreasing",
  Unknown: "unknown",
};

/** One virus on a near card: PHAC level and trend verbatim, dated, with provenance. */
export function VirusStatementRow({ row }: { row: NearRowView }) {
  const activity = row.badge.kind === "level" ? row.badge.activity : "unknown";
  const reason = row.badge.kind === "unknown" ? row.badge.reason : undefined;
  return (
    <li className={styles.row} data-pathogen={row.pathogen}>
      <span className={styles.rowName}>{virusLabel(row.pathogen)}</span>
      <span className={styles.rowMeta}>
        <LevelBadge activity={activity} {...(reason ? { reason } : {})} />
        <TrendGlyph trend={DIRECTION_BY_WORD[row.trend.word]} />
        {row.unknownText ? <span>{row.unknownText}</span> : null}
        {row.regionLabel ? <span>{row.regionLabel}</span> : null}
        {row.weekStart ? <span className={styles.mono}>{weekOf(row.weekStart)}</span> : null}
        <span data-lantern={row.lantern.brightness}>{row.lantern.text}</span>
      </span>
      <ProvenanceTrigger model={row.provenance} />
      <span className={styles.voice} data-voice={activity}>
        {cardVoiceLine(activity)}
      </span>
    </li>
  );
}
