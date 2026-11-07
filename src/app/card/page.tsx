import { Suspense } from "react";
import { CardScreen } from "@/components/card/CardScreen";
import { CardLoading } from "@/components/card/CardLoading";

export default function CardPage() {
  return (
    <Suspense fallback={<CardLoading />}>
      <CardScreen />
    </Suspense>
  );
}
