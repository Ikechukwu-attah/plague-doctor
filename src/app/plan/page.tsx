import type { Metadata } from "next";
import { PlannerStepper } from "@/components/planner";
import { PageContainer } from "@/components/shell/PageContainer";
import { PLANNER_HEADING, PLANNER_INTRO } from "@/ui-copy";

export const metadata: Metadata = { title: `${PLANNER_HEADING} | Plague Doctor` };

export default function PlanPage() {
  return (
    <PageContainer>
      <h1>{PLANNER_HEADING}</h1>
      <p>{PLANNER_INTRO}</p>
      <PlannerStepper />
    </PageContainer>
  );
}
