import { BirdIcon } from "@/components/design-system";
import styles from "./Card.module.css";

/** Decorative wax seal bearing the bird glyph. Static; hidden from assistive tech. */
export function WaxSeal() {
  return (
    <span className={styles.seal} aria-hidden="true" data-testid="wax-seal">
      <BirdIcon size={34} strokeWidth={1.6} />
    </span>
  );
}
