# End-to-end tests

Playwright specs for the interactive UI.

One-time setup (downloads the browser):

```
npx playwright install chromium
```

Run:

```
npm run test:e2e
```

The config builds the app and serves it on port 3100 with `NEXT_PUBLIC_PD_TEST_CLOCK=1`, so specs can pin "today" with `pinClock(page)` from `e2e/helpers.ts` (`2026-11-02T15:00:00-05:00`). Projects: `desktop` (1440x900), `mobile` (390x844) and `reduced-motion`.

Vitest ignores this folder.
