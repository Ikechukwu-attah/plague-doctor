---
inclusion: fileMatch
fileMatchPattern: "src/{app,components,features}/**/*"
---
# Design language — scientific gothic

Source of truth: `design/*.dc.html` (hi-fi comps) and `docs/BUILD_PLAN.md` §5A.

- Tokens: ink-900 `#0B1020`, ink-800 `#121A30`, ink-700 `#1C2742`, parchment `#EADFC8`, parchment-dim `#B9AE98`, lantern `#F2B544`, fog-teal `#5FD3BC`, replay `#B79CFF`. Levels: high `#E0664F` ▲▲, moderate `#E9A84A` ▲, low `#7FB7A4` ▽, not detected `#8C93A8` ○, unknown = hatched + "No data".
- Fonts (SIL OFL): Cormorant Garamond (display), Inter (UI), JetBrains Mono (dates/IDs/numbers).
- **Colour is never the only signal**: always icon + word (+ hatch for unknown).
- **Lantern brightness = data freshness, never activity.** Fog density = PHAC activity index for one selected virus; unknown = hatched, never "no fog".
- Replay UI always framed in `replay` purple with "REPLAY — archived PHAC data, {capture date}".
- Accessibility: WCAG 2.2 AA, keyboard paths for everything the map does, screen-reader chart summaries, ≥ 44 px targets, `prefers-reduced-motion` → static fog.
- Every screen designs four states: loading, empty/no data, error/stale, success.
- No gore, no fear slogans, no emoji in UI.
