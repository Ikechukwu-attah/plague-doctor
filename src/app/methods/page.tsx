import type { Metadata } from "next";
import { PageContainer } from "@/components/shell/PageContainer";
import { MethodsLive } from "@/components/methods/MethodsLive";
import { MaskReveal } from "@/components/methods/MaskReveal";
import { socialMetadata } from "@/lib/social-metadata";
import { SOCIAL_METHODS } from "@/ui-copy/social";

export const metadata: Metadata = socialMetadata(SOCIAL_METHODS);

export default function MethodsPage() {
  return (
    <PageContainer>
      <MaskReveal>
        <MethodsLive />
      </MaskReveal>
    </PageContainer>
  );
}
