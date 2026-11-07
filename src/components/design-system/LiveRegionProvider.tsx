"use client";
/**
 * Minimal polite live region (UI-12, UI-13). Components call useAnnounce()
 * to have state changes read out by assistive technology.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type Announce = (message: string) => void;

const LiveRegionContext = createContext<Announce>(() => {});

export function LiveRegionProvider(props: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  // Clearing first makes repeated identical messages announce again.
  const announce = useCallback<Announce>((next) => {
    setMessage("");
    setTimeout(() => setMessage(next), 50);
  }, []);
  const value = useMemo(() => announce, [announce]);
  return (
    <LiveRegionContext.Provider value={value}>
      {props.children}
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {message}
      </div>
    </LiveRegionContext.Provider>
  );
}

export function useAnnounce(): Announce {
  return useContext(LiveRegionContext);
}

/** Announces `message` whenever it changes to a new non-empty value (resource state changes). */
export function useAnnounceOnChange(message: string | null): void {
  const announce = useAnnounce();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (message && message !== last.current) announce(message);
    last.current = message;
  }, [message, announce]);
}
