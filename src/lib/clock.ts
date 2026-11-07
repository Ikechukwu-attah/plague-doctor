"use client";

/**
 * Injectable clock (UI-14.7, UI-14.8).
 * The ONLY file in src/app, src/components, src/lib allowed to read the system time.
 */
import { createContext, createElement, useContext, useState } from "react";
import type { ReactNode } from "react";
import { toTorontoDateString } from "@/evidence/date-utils";

export interface Clock {
  now(): Date;
}

declare global {
  interface Window {
    __PD_TEST_NOW__?: string;
  }
}

/**
 * System clock. When built with NEXT_PUBLIC_PD_TEST_CLOCK=1 it honours
 * window.__PD_TEST_NOW__ (ISO string). The env check is a build-time constant,
 * so the branch is eliminated from production bundles.
 */
export const systemClock: Clock = {
  now: () => {
    if (
      process.env.NEXT_PUBLIC_PD_TEST_CLOCK === "1" &&
      typeof window !== "undefined" &&
      typeof window.__PD_TEST_NOW__ === "string"
    ) {
      const fixed = new Date(window.__PD_TEST_NOW__);
      if (!Number.isNaN(fixed.getTime())) return fixed;
    }
    return new Date();
  },
};

const ClockContext = createContext<Clock>(systemClock);

export function ClockProvider(props: { clock?: Clock; children: ReactNode }) {
  return createElement(
    ClockContext.Provider,
    { value: props.clock ?? systemClock },
    props.children,
  );
}

export function useClock(): Clock {
  return useContext(ClockContext);
}

/** Frozen once per mount so renders are stable and tests can fix it. */
export function useToday(): { now: Date; todayIso: string } {
  const clock = useClock();
  const [today] = useState(() => {
    const now = clock.now();
    return { now, todayIso: toTorontoDateString(now) };
  });
  return today;
}
