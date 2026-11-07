import type { ReactNode } from "react";
import { Notice } from "@/components/design-system/Notice";
import { staleBanner } from "@/ui-copy/states";

/** "Showing last verified data from week of {date}". The caller decides when it applies. */
export function StaleBanner(props: { week: string; action?: ReactNode }) {
  return (
    <Notice tone="caution" {...(props.action ? { action: props.action } : {})}>
      {staleBanner({ week: props.week })}
    </Notice>
  );
}
