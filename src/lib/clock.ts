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

/**
 * ISO-8601 timestamp for an instant, written with its America/Toronto wall-clock
 * time and offset (e.g. "2026-11-07T23:30:00-05:00"). Same instant as the input,
 * but its first 10 characters are the Toronto calendar date (never the UTC date).
 */
export function toTorontoIso(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).formatToParts(instant);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  const offset = get("timeZoneName").replace("GMT", "").replace("\u2212", "-");
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${offset || "+00:00"}`;
}

/** The viewer's resolved IANA time zone (falls back to UTC if unavailable). */
export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export interface LocalDateParts {
  /** "YYYY-MM-DD" calendar date in the zone. */
  date: string;
  /** "HH:MM:SS" wall-clock time in the zone. */
  time: string;
  /** "+HH:MM" / "-HH:MM" offset of the zone at that instant. */
  offset: string;
}

/** Calendar date, time and offset of an instant in the viewer's zone (or `timeZone`). */
export function localDateParts(instant: Date, timeZone: string = viewerTimeZone()): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).formatToParts(instant);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  const offset = get("timeZoneName").replace("GMT", "").replace("\u2212", "-") || "+00:00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
    offset,
  };
}

/** ISO-8601 with the viewer's wall-clock time and offset; same instant as the input. */
export function toLocalIso(instant: Date, timeZone?: string): string {
  const p = localDateParts(instant, timeZone);
  return `${p.date}T${p.time}${p.offset}`;
}

/**
 * Calendar date ("YYYY-MM-DD") to display for a stored createdAt. Values written with a
 * numeric offset keep their own local date part; legacy Z-stamped values are converted
 * into the viewer's zone.
 */
export function createdLocalDate(createdAt: string, timeZone?: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T[\d:.]+([+-]\d{2}:\d{2})$/.exec(createdAt);
  if (m?.[1] && m[2] !== "+00:00") return m[1];
  return localDateParts(new Date(createdAt), timeZone).date;
}

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
