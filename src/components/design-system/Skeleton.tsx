import { LanternSkeleton, type LanternSkeletonProps } from "./LanternSkeleton";

export type SkeletonProps = Pick<LanternSkeletonProps, "variant" | "lines" | "rows" | "aspect" | "height">;

/** Placeholder for pending data. Delegates to the lantern-and-fog skeleton; same reserved heights as before. */
export function Skeleton(props: SkeletonProps) {
  return <LanternSkeleton {...props} />;
}
