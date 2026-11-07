/**
 * Wording guard — EVD-7.
 * Rejects any string containing banned safety/forecast phrases.
 * Whole-word, case-insensitive matching with an allowlist of required
 * negations ("not a prediction", etc.) exempted BEFORE scanning.
 * Pure function; no I/O; no side effects.
 */

export interface WordingCheckResult {
  passed: boolean;
  violations: string[];
}

const ALLOWLIST: readonly string[] = [
  "too early to know — not conditions on your date",
  "not a prediction",
  "not a forecast",
  "no-forecast",
  "not conditions on your date",
  "not on your event date",
];

const BANNED_WORDS: readonly string[] = [
  "safe",
  "unsafe",
  "dangerous",
  "risk-free",
  "you will get sick",
  "you won't get sick",
  "probability of infection",
  "will be high",
  "will be low",
  "forecast for your event",
  "predict",
  "prediction",
  "no infections",
  "virus-free",
  "all clear",
  "PHAC endorses",
  "endorsed by PHAC",
  "recommended by PHAC",
];

const BANNED_PATTERNS: readonly { label: string; re: RegExp }[] = [
  { label: "% chance", re: /\d+\s*%\s*chance/i },
  { label: "% chance", re: /percent\s+chance/i },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordRegex(term: string): RegExp {
  return new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
}

export function checkWording(text: string): WordingCheckResult {
  if (!text) return { passed: true, violations: [] };

  let working = text;
  for (const phrase of ALLOWLIST) {
    const re = new RegExp(escapeRegex(phrase), "gi");
    working = working.replace(re, (m) => " ".repeat(m.length));
  }

  const violations = new Set<string>();

  for (const term of BANNED_WORDS) {
    if (wordRegex(term).test(working)) violations.add(term);
  }
  for (const { label, re } of BANNED_PATTERNS) {
    if (re.test(working)) violations.add(label);
  }

  return { passed: violations.size === 0, violations: [...violations] };
}
