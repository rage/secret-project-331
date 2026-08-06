# @moocfi/exercise-client

## Browser contracts

Browser contracts live in `playwright/plugin-contract/` and `playwright/iframe-boundary/`.

Run all browser contracts with `pnpm run test:playwright`, an individual level with
`pnpm run test:playwright:plugin-contract` or `pnpm run test:playwright:iframe-boundary`, and use
`pnpm run test:playwright:debug` for interactive diagnostics. `pnpm run verify` builds the package,
runs unit tests, and runs the complete browser suite. CI runs Chromium and Firefox for pull
requests; the full contract job also runs WebKit. Failed tests retain traces, full-page screenshots,
and video.
