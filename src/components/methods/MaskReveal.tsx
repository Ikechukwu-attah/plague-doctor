"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./MaskReveal.module.css";

export const MASK_REVEAL_MS = 600;
export const MASK_SEEN_KEY = "pd.maskSeen";

/**
 * First-view mask-lift (UI-19.28). The children are always in the DOM and never delayed; a decorative,
 * non-interactive curtain mounts after hydration and lifts away. Skipped for reduced motion and after
 * the first view in a browser session. Stores only a "seen" flag, nothing about the user.
 */
export function MaskReveal({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(MASK_SEEN_KEY) === "1";
    } catch {
      seen = true; // storage blocked: skip rather than replay every visit
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (seen || reduced) return;
    setPlaying(true);
    const t = window.setTimeout(() => {
      setPlaying(false);
      try {
        window.sessionStorage.setItem(MASK_SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
    }, MASK_REVEAL_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      {children}
      {playing && (
        <div className={styles.mask} aria-hidden="true" data-mask-reveal style={{ animationDuration: `${MASK_REVEAL_MS}ms` }}>
          <svg className={styles.glyph} viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 30c20-22 44-22 52-4 8-18 32-18 52 4-6 30-30 46-52 46S14 60 8 30z" />
            <circle cx="38" cy="36" r="7" />
            <circle cx="82" cy="36" r="7" />
          </svg>
        </div>
      )}
    </>
  );
}
