/**
 * PHAC prevention checklist — EVD-10.
 * Items sourced verbatim from the PHAC "Respiratory infectious diseases:
 * How to reduce the spread — personal protective measures" page.
 * Do NOT paraphrase, reorder, or abbreviate.
 */
import type { PreventionChecklist } from "../card-types";

export const PREVENTION_CHECKLIST: PreventionChecklist = {
  items: [
    "Get your recommended vaccines.",
    "Stay home when you're sick.",
    "Wear a well-fitting respirator or mask.",
    "Improve indoor ventilation.",
    "Clean your hands regularly.",
    "Cover your coughs and sneezes.",
  ],
  sourceUrl:
    "https://www.canada.ca/en/public-health/services/diseases/respiratory-infectious-diseases-reduce-spread-personal-protective-measures.html",
  reviewedOn: "2026-10-31",
} as const;
