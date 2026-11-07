import { Skeleton } from "@/components/design-system/Skeleton";
import { OMEN_CARD_LABEL } from "@/ui-copy/card";

/** Card loading state: keeps the route's single h1; shows no values. */
export function CardLoading() {
  return (
    <div>
      <h1 className="visually-hidden">{OMEN_CARD_LABEL}</h1>
      <Skeleton variant="card" />
    </div>
  );
}
