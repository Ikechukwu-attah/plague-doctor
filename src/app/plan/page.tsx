import type { Metadata } from "next";
import { PlannerStepper } from "@/components/planner";
import { PageContainer } from "@/components/shell/PageContainer";
import { socialMetadata } from "@/lib/social-metadata";
import { PLANNER_HEADING, PLANNER_INTRO, SOCIAL_PLAN } from "@/ui-copy";

export const metadata: Metadata = socialMetadata(SOCIAL_PLAN);

export default function PlanPage() {
  return (
    <PageContainer>
      <h1>{PLANNER_HEADING}</h1>
      <p>{PLANNER_INTRO}</p>
      <PlannerStepper />
    </PageContainer>
  );
}
