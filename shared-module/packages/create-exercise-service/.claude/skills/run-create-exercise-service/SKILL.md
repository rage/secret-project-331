---
name: run-create-exercise-service
description: Build, run, and drive the create-exercise-service scaffolding CLI (which generates a new moocfi exercise service/plugin from the example-exercise template), and author the exercise itself — design its data model and implement its views/endpoints. Use when asked to run/start/scaffold/generate/create a new exercise service or plugin, to design/author/implement a new exercise type or its data model (private/public/model-solution specs, answer, grading), or to smoke-test/screenshot/verify the generated service or the create-exercise-service CLI.
---

# Run: create-exercise-service

`create-exercise-service` is an **interactive Node CLI** (`@inquirer/prompts`) that scaffolds a new
standalone exercise-service plugin by copying `services/example-exercise` and vendoring the shared
exercise packages into `src/shared-module/`. Its output is a runnable TanStack Start (rsbuild) web
app, so "driving" it fully means _scaffolding a project and booting what it produced_.

The primary agent path is the driver **`.claude/skills/run-create-exercise-service/smoke.mjs`**: it
scaffolds into a temp dir, asserts the structure, and (with `--boot`) installs the generated project
and verifies it serves the exercise-service HTTP contract. That runtime check is what catches
**template drift** — the CLI copies `services/example-exercise` live from disk, so it reflects the
template on the checked-out branch (currently TanStack Start on rsbuild; older branches such as
`master` still had the Next.js template, with which this generator is _not_ compatible).

> Paths below are relative to the unit dir `shared-module/packages/create-exercise-service`, **except**
> `bin/create-exercise-service`, which is at the **repo root**.

## Prerequisites

Node 24.x, pnpm 11.x, and `tmux` (for the interactive driver). For the optional screenshot,
`playwright-cli` + `chromium`. In this repo's Nix dev shell (`flake.nix`) all of these are already on
`PATH` — no `apt-get` was needed. Verify:

```bash
node --version   # v24.16.0 here (package.json pins 24.18.0 with onFail:download)
pnpm --version   # 11.9.0
tmux -V          # tmux 3.2a
```

## Setup

Install the CLI's own dev deps (it runs its TypeScript via `tsx` — there is no build step). From the
repo root:

```bash
pnpm --dir shared-module/packages/create-exercise-service install
```

## Run (agent path) — the driver

```bash
cd shared-module/packages/create-exercise-service/.claude/skills/run-create-exercise-service

# Fast: scaffold into a temp dir + structural assertions (~seconds)
node smoke.mjs

# Full: ALSO pnpm-install the generated project, boot its dev server, and hit the
# exercise-service endpoints (service-info, /iframe, public-spec). ~1 min. Cleans up + frees the port.
node smoke.mjs --boot

# Keep the generated temp project for inspection instead of deleting it
node smoke.mjs --keep
```

`--boot` output ends with `PASS` and exit 0 when the generated service installs and serves correctly:

```
  ok   GET /api/service-info -> service_name "Smoke exercise"
  ok   GET /iframe -> HTML document
  ok   POST /api/public-spec strips the `correct` flag (no answer leak)

PASS
```

To drive the **real interactive prompts** (use when a change touches the prompt flow itself) — a
tmux wrapper that answers each prompt and asserts the scaffold:

```bash
cd shared-module/packages/create-exercise-service/.claude/skills/run-create-exercise-service
./interactive-demo.sh
```

## Run (human path)

From the **repo root**, the launcher runs the interactive CLI (`pnpm start` → `tsx src/index.ts`):

```bash
bin/create-exercise-service
```

It prompts, in order: **Project name** → **Path** (default is the name, resolved relative to the CLI
package dir — pass an explicit path) → **Project type** (only _React_ works) → **Package manager** →
**Dev server port** (default `3002`, which collides with example-exercise — pick another) →
**Confirm** (default No, so type `y`). Then, per its printed next steps:

```bash
cd <your-project>
pnpm install
pnpm run dev            # → http://localhost:<port>
```

## Authoring your exercise (after scaffolding)

The scaffold is a **complete multiple-choice exercise**, not a blank skeleton — you turn it into your
exercise type by editing the ~20% that is exercise-specific and reusing the rest. But before you
touch any of that code, lock the data model down **with the user**.

### Step 0 — Confirm the data model with the user (mandatory; do not write code until signed off)

An exercise plugin's five data types are **stored forever in a host database you cannot migrate** —
old blobs keep replaying into your endpoints and views indefinitely (a 3-year-old answer re-POSTed to
`/api/grade`, an old private spec re-opened in the editor). _The private spec is your schema; you
just don't get `ALTER TABLE`._ And the derivation from private → public spec is the anti-cheating
boundary: a field you forget to drop leaks answers into every student's browser **irreversibly** — the
spec was already served. These are the most expensive-to-get-wrong decisions in the whole task, so
**stop and get explicit user sign-off on the model before implementing.**

Read **`reference/07-key-design-decisions.md`** in full, then present a concrete _proposed_ model and
confirm each of the following with the user. Use `AskUserQuestion` — propose a recommended shape for
each, don't ask open-ended questions:

1. **Versioned `private_spec`** — the master shape and where its `version` discriminant lives. Put
   one in from day one; quizzes' lack of it forced an entire migration layer.
2. **The two projections** — what `public_spec` and `model_solution_spec` each **drop**, built by
   explicit field-pick (never `{...spec}` + `delete`, which leaks every future field by default).
   Walk the leak catalogue in 07 §3c with the user: correctness encoded in ordering, id patterns,
   asymmetric metadata, counts/weights, or authoring artifacts.
3. **Visibility under peer review / exam mode** — the answer, feedback, and model solution can all
   reach _other students_ once peer review is on; design as if it always is (07 §3a).
4. **`answer`** — minimal, id-referencing (store `selectedOptionId`, not the label), versioned, and
   sufficient to grade from `private_spec + answer` alone (no session, no DB).
5. **Validity** — the invariants (≥1 option, exactly-one-correct, non-empty prompt, …) behind a
   single `validate(privateSpec)` that drives the `valid` flag in `current-state`.
6. **Grading model** — sync (`FullyGraded` inline) vs async (`Pending` + callback), and the
   partial-credit policy. Feedback must be safe assuming retries remain (the grader can't see the
   attempt count).
7. **Migration doors** — which entry points normalize old versions. Answer: all four (public-spec,
   model-solution, grade, and the editor's `set-state` handler).

Only once the user has signed off on the above, implement it.

### Implement the confirmed model

1. **Data types** — `src/util/stateInterfaces.ts`: encode the five confirmed types and their
   _forgiving_ parsers/guards (the iframe receives untyped `postMessage` data — degrade to
   defaults, don't crash). This is the entry point; everything else follows from these.
2. **Server transforms** — `src/server/publicSpec.ts` (the leak boundary — build the public spec by
   explicit pick), `modelSolution.ts`, and `grade.ts` (grade **server-side only**, from
   `private_spec + answer`). Keep grading code out of view files — public source maps ship it to
   students (07 §L8).
3. **Views** — `src/components/{ExerciseEditor,AnswerExercise,ViewSubmission}.tsx`. Keep the
   `IframeView`/`Renderer` skeleton; change what each view renders and the `current-state` it emits.
   Mint ids in the editor, never in the generators (re-derivation would orphan stored answers).
4. **CSV export** — `src/server/csvExportUtils.ts` is generic (pass your own item guard to
   `parseSpecArrayStrict`), but `exportAnswers.ts`/`exportDefinitions.ts` carry MC columns. To _drop_
   CSV export you must delete those two handlers, their `src/routes/api/export-*.ts` routes, and
   their tests — omitting the `service-info` paths alone leaves them breaking `tsc`/`vitest`.
5. **File uploads** — plugins don't store files; ask the host. Use `useFileUpload(port)`
   (`@/shared-module/exercise-react/react/hooks/useFileUpload`) → `uploadFiles(Map<name,File>)` returns
   a `Map<name,url>` you store in the `answer`. Don't hand-roll the `file-upload`/`upload-result`
   messages.

Keep verbatim: the protocol envelopes, `IframeView`/`Renderer`, `src/lib/apiRoutes.ts`, all of
`src/shared-module/`, `rsbuild.config.ts`, `server.mjs`, `iframe-headers.mjs`. The full reference —
the protocol, the change/keep split, backend/infra wiring, and the data-modelling + leak + testing
guide — ships in **`reference/`** (start at `reference/README.md`;
`reference/05-step-by-step-checklist.md` is the end-to-end sequence,
`reference/07-key-design-decisions.md` the data-model deep dive), alongside the shipped protocol doc
`docs/plugin-system.md`.

## Test

The CLI's own suite scaffolds into a temp dir and asserts the output (10 tests):

```bash
pnpm --dir shared-module/packages/create-exercise-service test
```

## Drive views in isolation (host emulator)

The scaffolded app is an iframe plugin; on its own it shows "Waiting for port..." until a host hands
it a `MessagePort`. The reusable host emulator lives in the shared package
**`@moocfi/exercise-service-test-utils`**; `src/browser/hostEmulator.js` is a single arrow-function
you inject as-is. It plays the parent: transfers the port (it waits for the iframe's `ready`, so
injection order doesn't matter), lets you push any view with `set-state`, auto-answers `file-upload`
(fake stored URLs) and `open-dialog`, and records the iframe's **full message history** so
`current-state` isn't lost among the frequent `height-changed` messages. Once injected,
`window.__host` exposes `setState(viewType, data)`, `last(type)`, `messages(type?)`,
`waitFor(type, pred?)`, `sendUploadResult`/`respondToDialog`, and `reset()`.

Boot a service first (a generated one via `node smoke.mjs --boot --keep` then
`PUBLIC_BASE_PATH="" PORT=<port> pnpm --dir <kept-dir> run dev`, the human path, or just
`pnpm --dir services/example-exercise run dev` for the template on `:3002`). Then, from the repo
root, with `playwright-cli` (Chromium is on `PATH`):

```bash
EMU=shared-module/packages/exercise-service-test-utils/src/browser/hostEmulator.js
BASE=http://localhost:3002
playwright-cli open "$BASE/iframe"                     # open FIRST so the iframe mounts
playwright-cli eval "$(cat "$EMU")"                    # installs window.__host + hands over the port

# Push a view. The 2nd arg is that view's `data` payload (see stateInterfaces.ts for your shapes):
playwright-cli eval "() => window.__host.setState('answer-exercise', { public_spec: [{ id: 'a', name: 'Helsinki' }, { id: 'b', name: 'Tampere' }], previous_submission: null })"

# example-exercise emits current-state when the student picks an option:
playwright-cli snapshot | grep checkbox                # -> - checkbox "Tampere" [ref=e8] ...
playwright-cli click e8
playwright-cli eval "() => JSON.stringify(window.__host.last('current-state'))"
# -> {"message":"current-state","data":{"selectedOptionId":"b"},"valid":true}
playwright-cli screenshot --filename view.png
playwright-cli close
```

**File-upload round-trip** — the emulator auto-answers `file-upload` with fake stored URLs, so you
only drive the input. The `playwright-cli` file-chooser dance is non-obvious: `snapshot` → get the
button `ref` → `click <ref>` (opens the chooser) → `upload <file>`. `upload` alone errors with "can
only be used when there is related modal state present". Against a file-submission plugin:

```bash
echo hello > /tmp/essay.txt
REF=$(playwright-cli snapshot | grep 'button "Choose File"' | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)
playwright-cli click "$REF"
playwright-cli upload /tmp/essay.txt
# The iframe records the stored URL in its answer and emits current-state:
playwright-cli eval "() => JSON.stringify(window.__host.last('current-state')?.data)"
# -> {"files":[{"name":"essay.txt","url":"https://uploads.example/essay.txt"}]}
```

To exercise the _failure_ path instead, turn auto-answering off and reply yourself: inject the
emulator with `{ autoUpload: false }`, wait for the `file-upload` message, then
`window.__host.sendUploadResult(requestId, { error: "quota exceeded" })` (same idea for
`respondToDialog` with `{ autoDialog: false }`).

## Durable tests (@playwright/test)

For committed tests, use the package's typed wrapper instead of raw `playwright-cli`.
`createHostEmulator(page)` (`.../exercise-service-test-utils/playwright/createHostEmulator`) injects
the same emulator and returns an async handle — `setState(state)`, `waitForViewType(vt)`,
`waitForCurrentState(pred?)`, `lastMessage`, `driveFileUpload(file)` — alongside typed `set-state`
builders (`answerExerciseState`, `exerciseEditorState`, `viewSubmissionState`). The scaffold ships a
working example at **`e2e/protocol.spec.ts`** (inherited by every generated project); copy and adapt
it to your data types. Run it against the dev server (Playwright boots it via `webServer`):

```bash
# In the moocfi dev shell, point Playwright at the system chromium (managed browsers aren't installed):
PLAYWRIGHT_CHROMIUM_PATH="$(command -v chromium)" pnpm --dir services/example-exercise exec playwright test
```

The emulator's protocol logic is also unit-tested with a mock `MessageChannel` (no browser):

```bash
pnpm --dir shared-module/packages/exercise-service-test-utils test
```

## Gotchas

- **The CLI copies the template live from disk** — `services/example-exercise` on the _current
  branch_. The template's framework and the CLI's parameterization must match. This branch is
  TanStack Start (`rsbuild.config.ts`); `master` was Next.js (`next.config.js`). Run the CLI against
  the branch's actual template; `smoke.mjs --boot` is the check that this still produces a bootable app.
- **`pkill -f "rsbuild dev"` kills your own shell.** The pattern matches the running Bash command's
  own argv (it contains the string), so the shell self-terminates (exit 144). Kill the dev server by
  pid instead: `PID=$(ss -ltnp | grep ':3009' | grep -oP 'pid=\K[0-9]+' | head -1); kill "$PID"`.
  `smoke.mjs` avoids this by launching the server `detached` and killing its process group.
- **Default port 3002 collides with example-exercise**, and the **default project path resolves
  relative to the CLI package dir** (the launcher `cd`s there), not to `services/`. Pass explicit
  values.
- **The generated project ships no lockfile** (excluded from the copy), so the first `pnpm install`
  resolves fresh (~30s; faster after, via the shared pnpm store).
- **Base path**: the dev server mounts under `PUBLIC_BASE_PATH`. Unset ⇒ served at root
  (`/api/service-info`, `/iframe`). Set it (e.g. `PUBLIC_BASE_PATH=/my-exercise`) to mimic
  production, and the endpoints become prefixed.
- **The iframe needs the parent handshake to render a view** — without it you get "Waiting for
  port...". Use the emulator from `@moocfi/exercise-service-test-utils` (see "Drive views in
  isolation"), which transfers the port and auto-answers `file-upload`/`open-dialog`, rather than
  hand-rolling the parent side.
- **Interactive prompts need a TTY** — pipe-driving `pnpm start` won't work; drive it under tmux
  (`send-keys`, paced with `sleep`), as `interactive-demo.sh` does.
- **Only the React project type is implemented**; selecting Svelte / No-framework exits 1.

## Troubleshooting

- `Target directory ... already exists and is not empty. Aborting.` — the CLI refuses a non-empty
  target. Use a fresh path (the drivers use fresh temp dirs).
- `tsx: command not found` / cannot find `@inquirer/prompts` — run the Setup `pnpm --dir ... install`.
- `bin/create-exercise-service: No such file or directory` — you ran it from the unit dir; it lives
  at the **repo root**. `cd` to the repo root first.
- Dev server unreachable from `smoke.mjs --boot` within 60s — the generated app failed to build
  (usually template drift). Re-run with `--keep` and `pnpm --dir <kept-dir> run dev` to see the
  rsbuild error.
