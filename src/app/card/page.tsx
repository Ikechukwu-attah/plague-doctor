import { Suspense } from "react";
import { CardScreen } from "@/components/card/CardScreen";
import { CardLoading } from "@/components/card/CardLoading";
import { PageContainer } from "@/components/shell/PageContainer";
export default function CardPage() {
  return (
    <PageContainer>
      <Suspense fallback={<CardLoading />}>
        <CardScreen />
      </Suspense>
    </PageContainer>
  );
}
