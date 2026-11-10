import { LanternSkeleton } from "@/components/design-system/LanternSkeleton";
import styles from "./Landing.module.css";

/** Same 1000:851 stage as the real `.mapBox` (and the same --map-max-h cap), so swapping it for the map shifts nothing. */
export const MAP_ASPECT = 1000 / 851;

/**
 * Task 17.14 (UI-19.28): lantern-and-fog placeholder inside the map panel. Server-renderable, shows no values.
 * Static under `prefers-reduced-motion` (see LanternSkeleton.module.css).
 */
export function MapPanelSkeleton() {
  return (
    <div className={styles.mapWrap} data-map-panel="" data-map-skeleton="" aria-busy="true">
      <div className={styles.mapBox}>
        <LanternSkeleton variant="map" aspect={MAP_ASPECT} />
      </div>
    </div>
  );
}
