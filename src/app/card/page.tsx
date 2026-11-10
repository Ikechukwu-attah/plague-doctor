import { Suspense } from "react";
import type { Metadata } from "next";
import { CardScreen } from "@/components/card/CardScreen";
import { CardLoading } from "@/components/card/CardLoading";
import { PageContainer } from "@/components/shell/PageContainer";
import { socialMetadata } from "@/lib/social-metadata";
import { SOCIAL_CARD } from "@/ui-copy/social";

export const metadata: Metadata = socialMetadata(SOCIAL_CARD);

export default function CardPage() {
  return (
    <PageContainer>
      <Suspense fallback={<CardLoading />}>
        <CardScreen />
      </Suspense>
    </PageContainer>
  );
}
