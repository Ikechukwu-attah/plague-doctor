import type { ReactNode } from "react";

/** Standalone polite live region for local, in-component announcements. */
export function LiveRegion({ children }: { children?: ReactNode }) {
  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {children}
    </div>
  );
}
