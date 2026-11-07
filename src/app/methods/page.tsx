import type { Metadata } from "next";
import { PageContainer } from "@/components/shell/PageContainer";
import { MethodsLive } from "@/components/methods/MethodsLive";

export const metadata: Metadata = {
  title: "Behind the mask — Plague Doctor",
  description: "Sources, definitions and limits of the PHAC wastewater data shown in Plague Doctor.",
};

export default function MethodsPage() {
  return (
    <PageContainer>
      <MethodsLive />
    </PageContainer>
  );
}
