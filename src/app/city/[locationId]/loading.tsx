import { Skeleton } from "@/components/design-system/Skeleton";
import { LOADING_LABEL } from "@/ui-copy/states";

export default function CityLoading() {
  return (
    <div>
      <h1 className="visually-hidden">{LOADING_LABEL}</h1>
      <Skeleton variant="rows" rows={4} />
    </div>
  );
}
