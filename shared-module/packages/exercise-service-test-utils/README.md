# @moocfi/exercise-service-test-utils

Testing utilities that play the **parent/host** side of the exercise-plugin iframe protocol, so you
can drive a plugin's views and observe the messages it emits without a real host.

An exercise service is an iframe app: it posts `"ready"`, the host transfers a `MessagePort`, and all
typed protocol messages (`set-state`, `current-state`, `height-changed`, `file-upload`,
`open-dialog`, …) flow over that port. To render any view you need a parent to hand over a port and
push a `set-state`; to assert behaviour you need to read the `current-state` the plugin emits (buried
among frequent `height-changed` messages) and answer `file-upload`/`open-dialog` round-trips. This
package packages exactly that host.

## What's here

- **`src/browser/hostEmulator.js`** — the emulator as a single self-contained arrow-function
  expression. Inject it as-is with `playwright-cli`:

  ```bash
  playwright-cli open http://localhost:<port>/iframe          # open the iframe page FIRST
  playwright-cli eval "$(cat src/browser/hostEmulator.js)"     # installs window.__host + hands over the port
  playwright-cli eval "() => window.__host.setState('answer-exercise', { public_spec: [], previous_submission: null })"
  playwright-cli eval "() => window.__host.last('current-state')"
  ```

  Once installed, `window.__host` exposes: `setState(viewType, data, overrides?)`,
  `setStateRaw(state)`, `setLanguage(code)`, `last(type)`, `messages(type?)`,
  `waitFor(type, predicate?, timeoutMs?)`, `sendUploadResult(requestId, {urls}|{error})`,
  `respondToDialog(requestId, confirmed)`, `sendRepositoryExercises(list)`,
  `sendTestResults(result)`, and `reset()`. By default it auto-answers `file-upload` (with fake
  stored URLs) and `open-dialog` (confirm); pass `{ autoUpload: false }` / `{ autoDialog: false }` to
  drive those responses yourself.

- **`src/playwright/createHostEmulator.ts`** — a typed `@playwright/test` wrapper. It injects the
  _same_ emulator source (via `page.evaluate`) and returns an async handle:
  `setState`, `setLanguage`, `lastMessage`, `waitForMessage(type, predicate?)`,
  `waitForCurrentState()`, `waitForViewType(vt)`, `waitForFileUpload()`, `fileUploadCount()`,
  `sendUploadResult`, `respondToDialog`, and `driveFileUpload(files, target?)`. It also exports
  `createNestedHostEmulator()` for sandboxed, distinct-origin iframe coverage. See
  `services/example-exercise/playwright/plugin-contract/protocol.spec.ts` and
  `services/example-exercise/playwright/iframe-boundary/nested-host.spec.ts` for examples.

- **`src/protocol/stateBuilders.ts`** — typed builders for the `set-state` payloads
  (`answerExerciseState`, `exerciseEditorState`, `viewSubmissionState`, `customViewState`) with sane
  defaults, so specs don't hand-roll the envelope.

## How it connects

`createHostEmulator()` injects into the iframe's own **top-level page** (where
`window === window.parent`) for fast plugin-contract tests. `createNestedHostEmulator()` instead
creates a sandboxed iframe on a distinct origin and transfers the real `MessagePort` across that
boundary. The nested helper covers cross-realm transport and exact upload bytes; the real
`@moocfi/exercise-iframe-host` remains covered by its own package tests.

## Testing

`pnpm test` runs jest unit tests (state builders + the emulator driven through a mock
`MessageChannel`, no browser). The Playwright wrapper is exercised by
package-local `playwright/plugin-contract/` and `playwright/iframe-boundary/` specs. Run the
complete browser suite with `pnpm run test:playwright`, a single level with
`pnpm run test:playwright:plugin-contract` or `pnpm run test:playwright:iframe-boundary`, and
inspect a failing test with `pnpm run test:playwright:debug`. CI runs Chromium and Firefox for
pull requests and adds WebKit in the full contract job. Failed runs retain Playwright traces,
full-page screenshots, and video in `test-results/`.
