import type { FreshnessLabel } from "@/evidence/card-types";
import type { ThreeClocksModel } from "@/lib/view/three-clocks";
import { ThreeClocks } from "@/components/design-system/ThreeClocks";
import { FreshnessLantern } from "@/components/design-system/FreshnessLantern";
import styles from "./Landing.module.css";

export function FreshnessFooter(props: { clocks: ThreeClocksModel; freshness?: FreshnessLabel }) {
  return (
    <footer className={styles.footer}>
      {props.freshness ? <FreshnessLantern label={props.freshness} /> : null}
      <ThreeClocks clocks={props.clocks} />
    </footer>
  );
}
