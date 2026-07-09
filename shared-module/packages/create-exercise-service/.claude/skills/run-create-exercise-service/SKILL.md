---
name: run-create-exercise-service
description: Scaffold, run, and smoke-test a new moocfi exercise service/plugin with the create-exercise-service CLI (generated from the example-exercise template), and author the exercise itself — its data model (private/public/model-solution specs, answer, grading) and its iframe views/REST endpoints. Use when asked to run/start/scaffold/generate/create/screenshot/verify an exercise service or plugin, or to design/author/implement a new exercise type or its data model.
allowed-tools: Read, Bash(node *), Bash(pnpm *), Bash(playwright-cli *)
---

# create-exercise-service

`create-exercise-service` is an **interactive Node CLI** (`@inquirer/prompts`) that scaffolds a new
standalone exercise-service plugin by copying `services/example-exercise` and vendoring the shared
exercise packages into `src/shared-module/`. Its output is a runnable TanStack Start (rsbuild) web
app. Everything is driven by three scripts in this skill dir: `smoke.mjs` (scaffold + HTTP contract),
`drive-view.mjs` (the iframe protocol against a real browser), and `interactive-demo.sh` (the prompt
flow).

This skill has two parts. **Part A — Run & smoke-test** the CLI and a generated service. **Part B —
Author a new exercise type** (design the data model, implement the views/endpoints). If you only need
to run/screenshot/verify, stop after Part A.

> Paths below are relative to the unit dir `shared-module/packages/create-exercise-service`, **except**
> `bin/create-exercise-service`, which is at the **repo root**.

---

# Part A — Run & smoke-test

## Prerequisites

Node 24.x, pnpm 11.x, and `tmux` (for the interactive driver). For `drive-view.mjs` and screenshots,
`playwright-cli` + `chromium`. In this repo's Nix dev shell (`flake.nix`) all of these are already on
`PATH` — no `apt-get` was needed. Verify:

```bash
node --version   # v24.16.0 here (package.json pins 24.18.0 with onFail:download)
pnpm --version   # 11.9.0
tmux -V          # tmux 3.2a
```

## Setup

Install the CLI's own dev deps (it runs its TypeScript via `tsx` — there is no build step):

```bash
pnpm --dir shared-module/packages/create-exercise-service install
```

## Run — the drivers

All three drivers live in this skill dir, so run them from there:

```bash
cd shared-module/packages/create-exercise-service/.claude/skills/run-create-exercise-service
```

**`smoke.mjs` — scaffold + HTTP contract** (the canonical drift check):

```bash
node smoke.mjs           # scaffold into a temp dir + structural assertions (~seconds)
node smoke.mjs --boot    # ALSO pnpm-install, boot the dev server, hit service-info/iframe/public-spec (~1 min)
node smoke.mjs --keep    # don't delete the temp project (inspect the output)
```

`--boot` ends with `PASS` and exit 0 when the generated service installs and serves correctly:

```
  ok   GET /api/service-info -> service_name "Smoke exercise"
  ok   POST /api/public-spec strips the `correct` flag (no answer leak)

PASS
```

**`drive-view.mjs` — the iframe protocol** (handshake → `set-state` → `current-state`, in Chromium).
`smoke.mjs` checks the HTTP contract; this checks the _iframe_ contract that HTTP can't reach. It
boots `services/example-exercise`, plays the host, pushes the answer view, clicks an option, and
asserts the emitted `current-state`:

```bash
node drive-view.mjs                                # boot example-exercise on :3002, drive it, tear down
node drive-view.mjs --screenshot view.png          # also save a screenshot of the driven view
node drive-view.mjs --base http://localhost:3998   # attach to an already-running service instead
```

```
  ok   emulator installed (window.__host present)
  ok   answer-exercise rendered ("Tampere" checkbox present)
  ok   current-state reports selectedOptionId "b" (valid=true)

PASS
```

To drive _your_ generated service, boot it and pass `--base`; edit the pushed `public_spec` in the
script to match your data types. The emulator it injects
(`@moocfi/exercise-service-test-utils`, `src/browser/hostEmulator.js`) plays the parent: transfers
the port, auto-answers `file-upload`/`open-dialog`, and records the iframe's full message history
(so `current-state` survives the `height-changed` spam). For committed tests, use the typed
`createHostEmulator` wrapper instead of raw driving — see Part B.

**`interactive-demo.sh` — the prompt flow** (use only when a change touches the prompts themselves;
otherwise `smoke.mjs` is enough):

```bash
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
**Confirm** (default No, so type `y`). Then `cd <project> && pnpm install && pnpm run dev`.

## Test

The CLI's own suite scaffolds into a temp dir and asserts the output (10 tests):

```bash
pnpm --dir shared-module/packages/create-exercise-service test
```

## Gotchas

- **The CLI copies the template live from disk** — `services/example-exercise` on the _current
  branch_ (currently TanStack Start, `rsbuild.config.ts`). The template's framework and the CLI's
  parameterization must match; `smoke.mjs --boot` is the check that this still produces a bootable app.
- **`pkill -f "rsbuild dev"` kills your own shell.** The pattern matches the running Bash command's
  own argv (it contains the string), so the shell self-terminates (exit 144). Kill the dev server by
  pid instead: `PID=$(ss -ltnp | grep ':3009' | grep -oP 'pid=\K[0-9]+' | head -1); kill "$PID"`.
  Both `smoke.mjs` and `drive-view.mjs` avoid this by launching the server `detached` and killing its
  process group.
- **A generated project's `--port` is baked into its `dev` script**, so a `PORT=<port>` env var has
  **no effect**. To run a kept smoke project on another port, override the flag:
  `pnpm --dir <kept-dir> exec rsbuild dev --port <port>`.
- **The generated project ships no lockfile** (excluded from the copy), so the first `pnpm install`
  resolves fresh (~30s; faster after, via the shared pnpm store).
- **Base path**: the dev server mounts under `PUBLIC_BASE_PATH`. Unset ⇒ served at root
  (`/api/service-info`, `/iframe`). Set it (e.g. `PUBLIC_BASE_PATH=/my-exercise`) to mimic production.
- **The iframe needs the parent handshake to render a view** — without it you get "Waiting for
  port...". Drive it with `drive-view.mjs` / the emulator, never by hand-rolling the parent side.
- **Interactive prompts need a TTY** — pipe-driving `pnpm start` won't work; drive it under tmux
  (`send-keys`, paced with `sleep`), as `interactive-demo.sh` does.
- **Default port 3002 collides with example-exercise, and the default path resolves relative to the
  CLI package dir** — see `reference/03-scaffolding-cli.md` for both. Pass explicit values.

## Troubleshooting

- `Target directory ... already exists and is not empty. Aborting.` — the CLI refuses a non-empty
  target. Use a fresh path (the drivers use fresh temp dirs).
- `tsx: command not found` / cannot find `@inquirer/prompts` — run the Setup `pnpm --dir ... install`.
- `bin/create-exercise-service: No such file or directory` — you ran it from the unit dir; it lives
  at the **repo root**. `cd` to the repo root first.
- Dev server unreachable from `smoke.mjs --boot` within 60s — the generated app failed to build
  (usually template drift). Re-run with `--keep` and `pnpm --dir <kept-dir> run dev` to see the
  rsbuild error.

---

# Part B — Author a new exercise type

The scaffold is a **complete multiple-choice exercise**, not a blank skeleton — you turn it into your
exercise type by editing the ~20% that is exercise-specific and reusing the rest. But before you
touch any code, lock the data model down **with the user**.

## Step 0 — Confirm the data model with the user (mandatory; do not write code until signed off)

An exercise plugin's five data types are **stored forever in a host database you cannot migrate** —
old blobs keep replaying into your endpoints and views indefinitely (a 3-year-old answer re-POSTed to
`/api/grade`, an old private spec re-opened in the editor). _The private spec is your schema; you
just don't get `ALTER TABLE`._ And the derivation from private → public spec is the anti-cheating
boundary: a field you forget to drop leaks answers into every student's browser **irreversibly** — the
spec was already served. These are the most expensive-to-get-wrong decisions in the whole task.

So: read **`reference/07-key-design-decisions.md`** in full, then work through **its one-screen
checklist** (versioned specs, the two projections + leak catalogue, visibility under peer
review/exam mode, the answer shape, validity invariants, grading model, migration doors) _with the
user_. Present a concrete _proposed_ model and get explicit sign-off on each item via
`AskUserQuestion` — propose a recommended shape, don't ask open-ended questions. **Only implement
once the user has signed off.**

## Then implement the confirmed model

`reference/05-step-by-step-checklist.md` is the end-to-end sequence; follow it. In short: encode the
five types in `src/util/stateInterfaces.ts` → implement the three server transforms
(`src/server/{publicSpec,modelSolution,grade}.ts`; grade **server-side only**) → update the three
views (`src/components/{ExerciseEditor,AnswerExercise,ViewSubmission}.tsx`, keeping the
`IframeView`/`Renderer` skeleton). You change ~20% and keep ~80% verbatim — see the change-vs-keep
split in `reference/05`.

Verify as you go with `drive-view.mjs` (Part A). For committed tests, adapt the inherited
`e2e/protocol.spec.ts` (every generated project ships it) — it uses the typed `createHostEmulator`
wrapper and `set-state` builders. Run it against the dev server (Playwright boots it via `webServer`):

```bash
PLAYWRIGHT_CHROMIUM_PATH="$(command -v chromium)" pnpm --dir services/example-exercise exec playwright test
```

## Reference material

Bundled in **`reference/`** (start at `reference/README.md`), alongside the shipped protocol doc
`docs/plugin-system.md`:

- `01` protocol (a delta over `docs/plugin-system.md`), `02` the template's file-by-file anatomy,
  `03` the scaffolder internals, `04` backend/infra wiring (first-party plugins).
- `05` the end-to-end checklist (the actionable spine), `06` the design rationale.
- `07` the data-modelling + leak + testing deep dive — the source of the Step-0 gate above.
