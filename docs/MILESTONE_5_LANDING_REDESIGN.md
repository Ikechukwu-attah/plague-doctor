# Milestone 5 — Landing page layout fixes

Source: the owner's review of the live landing page (2026-11-10), confirmed by the lead in a
browser at 1440×900 and 375×812. Add as task group 18 in `.kiro/specs/interactive-surveillance-ui/`,
then implement. All steering rules still apply.

## 18.1 Bug: about 2,400 px of empty page below the footer (desktop)
Measured: `body.scrollHeight` = 1213, but `documentElement.scrollHeight` = 3649. The cause is the
`.visually-hidden` spans inside each city-list row. They are `position:absolute`, but no ancestor
inside the scrolling list (`.Landing_list ul`, `overflow:auto`) is positioned. So they lay out
against the page, and the last one sits at y = 3648.
- Fix: give the list scroller and its rows `position: relative`. Also harden the global
  `.visually-hidden` utility to the standard pattern: `position:absolute; width:1px; height:1px;
  margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap`, so it can never extend
  layout.
- Test (Playwright, 1440 and 390, on `/`, `/plan`, `/methods`, `/card`, `/city/toronto`):
  `documentElement.scrollHeight` is within 2 px of the footer's bottom edge.

## 18.2 Replace numbered clusters with a map that has room for every city
The owner doesn't want "12 places" bubbles: a judge should see and click every city. Clustering
was only needed because the map is drawn small. The projection uses a 1000×851 viewBox, and Canada
fills only about the lower-left two-thirds of it. Each city should get its own marker:
- Fit the projection to the panel with `fitExtent`, using the bounding box of all monitored
  locations plus the provinces they sit in, with padding. The populated southern band should fill
  the width. Draw the territories cropped at the top edge rather than shrinking everything to fit
  them.
- Remove the numbered clusters. Where markers would still overlap (the Windsor–Québec corridor and
  the Lower Mainland), nudge them apart with a small deterministic dodge (collision relaxation) and
  draw a thin leader line from each marker to its true point. The true coordinates stay the same.
- Visible dot about 14 px. The hit target is at least 24×24 px (WCAG 2.5.8) and never overlaps
  another marker's. Keep the existing marker hit-test e2e (`elementFromPoint` returns the
  marker itself) for every marker at 1440 and 1024. At 390, the "Show map" toggle path is fine.
- Labels: show a name label for the selected or hovered marker, plus the comp's labelled cities
  where there's room (the 18.x placement rule is unchanged). Never overlap.

## 18.3 Map full width; city list as a proper table below it (desktop)
Right now the list is a narrow 340 px box with a fixed 573 px height and its own scroll. It looks
like it's floating, and the rows are cramped: names wrap ("Birch Hills", "Campbellton"), and the
status, trend and "week of" text squeeze together.
- At 1024 px and wider, the map takes the full content width (about 16:9, at most 70 vh).
- Below it, "All places" is a full-width table with columns: City · Province · PHAC level ·
  Trend · Sample week · Freshness. The column headers do the sorting (`aria-sort`), replacing the
  separate "Sort list" select, and the sort stays in the URL. The search box filters the table. The
  page scrolls normally, with no inner scroll box.
- Rows are one line on desktop, and nothing wraps except long names, which ellipsize with the full
  name in `title` and the accessible name. Clicking a row opens the same city drawer as clicking
  the marker.
- On phones (under 768 px), keep the current stacked list, but fix the row layout: line 1 is the
  name with the status badge right-aligned; line 2 is the trend and "week of" date, left-aligned
  under the name, with no overlap.

## 18.4 Controls row
Put the virus chips, "Show discontinued sites", "Show places without data" and "Browse as list"
on one aligned row at desktop width, wrapping cleanly below 1024 px. The sort control moves into
the table headers (18.3).

## Done means
- tsc, vitest, Playwright all green, including the new page-height test and marker hit-tests
  for every marker.
- Lighthouse mobile on `/` (median of 3): perf at least 90, LCP no more than 2.5 s, CLS under 0.1.
- Screenshots at 1440×900 and 390×844: the landing page at the top, and the landing page scrolled
  to the footer, which must show no empty space below it.
- Update tasks.md and KIRO_USAGE.md. Don't deploy.
