# Browser integration testing

Browser coverage is evidence about a boundary, not a generic green check. Keep the three levels
below separate, make each test the narrowest claim it can actually prove, and run every level the
exercise requires. An emulator is excellent contract evidence; it is not evidence about the real
host.

## Required layout

All browser tests and their assets live under one top-level directory:

```text
playwright/
  plugin-contract/
  iframe-boundary/
  system/
  fixtures/
```

- `plugin-contract/` contains plugin behavior exercised through the typed host emulator.
- `iframe-boundary/` contains sandboxed, distinct-origin iframe transport tests.
- `system/` contains integration tests against a real deployed host.
- `fixtures/` contains committed files and shared Playwright fixtures/helpers; it is not a test
  level.

Do not put browser specs elsewhere. A legacy `e2e/` directory, a browser spec outside
`playwright/<level>/`, or a required level that discovers zero tests is a failing verification
condition. Configure Playwright with `testDir: "./playwright"` and named projects that state both
the level and browser.

## The three evidence levels

### Plugin contract

Use the typed `createHostEmulator()` API and real `set-state` builders. This layer proves that the
plugin renders the protocol state, emits the expected `current-state`, and handles host responses.
It should be fast and normally run in Chromium on every change.

Cover the complete authored behavior, not only happy paths:

- editor controls, emitted private spec, and transitions into and out of invalid state;
- answer happy paths, every designed client rejection, removal/undo, multi-item answers, and
  `previous_submission` seeding (including the seeded `valid` emission);
- view-submission with answer, grading and feedback, plus empty and unknown-data cases;
- old stored versions entering through `set-state` and emitting the current migrated shape;
- host errors, malformed/missing response data, delays, and concurrent response correlation where
  the protocol interaction can overlap.

The emulator may return deterministic URLs so the plugin can finish its state transition. That
proves only how the plugin handles a host response.

### Iframe boundary

Use `createNestedHostEmulator()` (or the shared equivalent) with host and plugin on **distinct
origins**. Exercise the actual sandboxed iframe handshake, transferred `MessagePort`, and transport
through the real browser boundary. Do not replace this with direct page injection or a same-origin
component mount.

Run this level in Chromium, Firefox, and WebKit. For file upload, prove that the exact selected file
metadata and bytes survive the nested boundary in all three engines. This level establishes browser
serialization and message correlation; it still does not establish what a production host does
after receiving the message.

### System / real host

Use the deployed `https://courses.mooc.fi/playground-tabs` Playground as the host and start only the
local plugin. Configure the Playground with the local service-info URL. Do not substitute an
emulator, a local copy of host code, or a fabricated upload-success message.

For a host-mediated upload claim, inspect the real `/api/v0/files/playground` multipart request and
assert its field name, filename, MIME type, length, exact bytes, and SHA-256. Then assert the returned
URL and retrieved bytes, the plugin's `current-state`, and view-submission rendering. Do not persist
a real course merely to prove this flow.

If a known host regression prevents the multipart file from being sent, leave the assertion as an
active ordinary failing test. Do not use `skip`, `fixme`, `test.fail`, a conditional early return, or
a route that fabricates success. The failure is the evidence that the system contract remains
broken; the exercise is not fully verified until it passes.

## Upload evidence: inspect before responding

Meaningful plugin-contract and iframe-boundary upload tests set `autoUpload: false`. Select a real
committed fixture through the rendered file input, then call `waitForFileUpload()` and assert the
browser-realm snapshot **before** sending a host response:

- `requestId` is present and is the id used by the correlated response;
- `filesKind` is `"map"` (plain objects and arrays are not accepted as equivalent wire data);
- the entries have the exact expected keys and order;
- each entry is the expected `"file"` or `"blob"` kind;
- filename, MIME type, byte size, and `lastModified` semantics are correct;
- SHA-256 equals the fixture's known digest and the observed bytes/length equal the fixture exactly.

Build the snapshot in the browser realm before Playwright serialization. `Map`, `File`, and `Blob`
must not be inferred from the empty-looking object that cross-realm serialization can produce.
Respond only after every assertion passes, using the captured `requestId`. Tests for host rejection,
missing URLs, delayed responses, and concurrent uploads should likewise control their responses
manually. A client-side rejection must assert that `fileUploadCount()` does not increase.

At minimum, file-upload exercises cover:

- successful editor and answer uploads;
- host rejection and malformed/missing returned URL;
- delayed and concurrent response correlation;
- client-side type/count/size rejection with no outgoing upload message;
- multi-file selection, replacement/removal, and seeded prior answers;
- exact bytes across the distinct-origin boundary in all configured engines;
- the production Playground system request and post-success state described above.

## Execution and diagnostics

From the generated project root, use the bundled portable runner rather than guessing the package
manager, Playwright config, project names, server port, or browser executable:

```bash
node <skill-dir>/scripts/run-generated-playwright.mjs
```

The runner inspects the project, rejects `e2e/`, lists tests first, rejects zero discovered tests or
missing required levels, uses managed browsers pinned by the project when possible, honors a system
browser only through a hook exposed by the inspected config, and ends with the complete unfiltered
suite. It never performs privileged operating-system installation.

Keep page errors, console errors, request failures, trace, screenshot, and video artifacts on
failure. After the initial full run, focused runs are useful diagnostics; they are not the final
verification. Correct the failure and finish with the unfiltered suite. Playwright's `webServer`
normally starts the service, so do not start a second server unless the inspected configuration
requires it. Locators target rendered translated strings, not locale keys.

If browser installation, service startup, network access, a test, or any required layer fails,
report the exact failure and say verification is incomplete. Never turn unavailable evidence into a
passing claim.

## Claim checklist

Before saying an exercise is verified, state which evidence supports each claim:

| Claim | Minimum evidence |
| --- | --- |
| Plugin accepts/emits the designed protocol state | `plugin-contract` |
| Data survives a sandboxed cross-origin iframe boundary | `iframe-boundary` in every configured browser |
| Production host mediates an upload correctly | production Playground `system` test |

`drive-view.mjs` is an exploratory helper for quick visual inspection of the example exercise. It
uses an emulated host and hardcoded example data; screenshots or `PASS` output from it are never
verification evidence for any of the three levels.
