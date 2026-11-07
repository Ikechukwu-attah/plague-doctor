/**
 * America/Toronto date arithmetic helpers — EVD-1, EVD-3.
 * Uses Intl.DateTimeFormat + noon-UTC anchoring to avoid DST edge-cases.
 * No side effects; no I/O.
 */

/**
 * Convert a Date or ISO date string to a wall-clock calendar date string in
 * America/Toronto ("YYYY-MM-DD").
 *
 * Date-only strings (YYYY-MM-DD) are anchored to noon UTC before converting,
 * which prevents midnight-UTC strings from straddling a different Toronto
 * calendar day around the UTC-4/UTC-5 offset.
 */
export function toTorontoDateString(d: Date | string): string {
  const date =
    typeof d === "string"
      ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d)
      : d;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // "YYYY-MM-DD"
}

/**
 * Calendar-day difference between two Toronto date strings.
 * Returns Math.round((to - from) / msPerDay) in whole days.
 * Both inputs MUST be "YYYY-MM-DD" Toronto wall-clock date strings.
 * Noon-UTC anchoring on both sides means DST never shifts the count.
 */
export function calendarDayDiff(from: string, to: string): number {
  const ms =
    new Date(`${to}T12:00:00Z`).getTime() -
    new Date(`${from}T12:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Format a YYYY-MM-DD ISO date string as a human-readable date
 * for display copy, e.g. "Oct 18, 2026".
 */
export function formatDisplayDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Map a calendar date (YYYY-MM-DD) to its epidemiological week.
 * Returns the EpiWeek whose Sunday weekStart is on or before the given date
 * (at most 6 days earlier). EpiWeeks start on Sunday (US CDC convention,
 * which PHAC uses).
 *
 * Algorithm:
 * 1. Convert date to Toronto wall-clock date.
 * 2. Find the most recent Sunday on or before that date.
 * 3. Compute epiYear and epiWeek from that Sunday.
 */
export function dateToEpiWeek(date: string): {
  epiYear: number;
  epiWeek: number;
  weekStart: string;
} {
  // Parse as noon UTC to get a stable Toronto calendar date
  const d = new Date(`${date}T12:00:00Z`);

  // Day of week in Toronto (0 = Sunday)
  const dowStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
  }).format(d);
  const DOW_MAP: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dow = DOW_MAP[dowStr] ?? 0;

  // Subtract days to reach the most recent Sunday
  const sundayMs = d.getTime() - dow * 86_400_000;
  const sunday = new Date(sundayMs);

  // Format as YYYY-MM-DD in Toronto time
  const weekStart = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(sunday);

  // MMWR / CDC EpiWeek convention (used by PHAC): week 1 is the first
  // Sunday-start week with at least four days in the calendar year, i.e. the
  // Sunday on or before Jan 4. Year and week come from the week's Sunday.
  const DAY = 86_400_000;
  const week1Start = (y: number): number => {
    const jan4 = Date.UTC(y, 0, 4, 12);
    return jan4 - new Date(jan4).getUTCDay() * DAY;
  };
  const sundayUtc = Date.UTC(
    parseInt(weekStart.slice(0, 4), 10),
    parseInt(weekStart.slice(5, 7), 10) - 1,
    parseInt(weekStart.slice(8, 10), 10),
    12,
  );
  let epiYear = parseInt(weekStart.slice(0, 4), 10);
  if (sundayUtc >= week1Start(epiYear + 1)) epiYear += 1;
  else if (sundayUtc < week1Start(epiYear)) epiYear -= 1;
  const weekNumber =
    Math.round((sundayUtc - week1Start(epiYear)) / (7 * DAY)) + 1;

  return {
    epiYear,
    epiWeek: weekNumber,
    weekStart,
  };
}

/**
 * Add whole calendar days to a YYYY-MM-DD date. Noon-UTC anchoring keeps the
 * result independent of DST and of the process time zone.
 */
export function addDaysIso(isoDate: string, days: number): string {
  const ms = new Date(`${isoDate}T12:00:00Z`).getTime() + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
