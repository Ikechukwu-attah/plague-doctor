import type { CityCoverageNotice } from "@/lib/view/city-view";
import { Notice } from "@/components/design-system/Notice";
import { Button } from "@/components/design-system/Button";
import { noAggregate, noCitySite, provincialAggregateNotice, AGGREGATE_COVERAGE_RULE } from "@/ui-copy/coverage";
import { HIDE_REGIONAL, SHOW_REGIONAL } from "@/ui-copy/city";
import styles from "./City.module.css";

export interface CoverageNoticeProps {
  notice: CityCoverageNotice;
  showingRegional: boolean;
  regionName?: string;
  onToggleRegional?: () => void;
}

/** UI-5.5 to UI-5.8: no monitoring site; the provincial aggregate is offered, never substituted. */
export function CoverageNotice({ notice, showingRegional, regionName, onToggleRegional }: CoverageNoticeProps) {
  if (notice.kind === "none") return null;
  const place = notice.cityName;
  if (notice.aggregate === "not_published") {
    return (
      <div className={styles.coverage}>
        <Notice tone="info">
          <p>{noCitySite({ place })}</p>
          <p>{noAggregate({ place })}</p>
          <p className={styles.muted}>{AGGREGATE_COVERAGE_RULE}</p>
        </Notice>
      </div>
    );
  }
  return (
    <div className={styles.coverage}>
      <Notice
        tone="info"
        action={
          onToggleRegional ? (
            <Button onClick={onToggleRegional} aria-pressed={showingRegional}>
              {showingRegional ? HIDE_REGIONAL : SHOW_REGIONAL}
            </Button>
          ) : undefined
        }
      >
        <p>{noCitySite({ place })}</p>
        {showingRegional && regionName ? <p>{provincialAggregateNotice({ place, region: regionName })}</p> : null}
      </Notice>
    </div>
  );
}
