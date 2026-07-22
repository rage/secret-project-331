---
name: create-exercise-type
description: Author a new moocfi exercise type (exercise service/plugin) — design its data model (private/public/model-solution specs, answer, grading) and iframe views through mandatory design gates with the user, then scaffold it with the create-exercise-service CLI and implement it. Default intent when invoked is authoring a new exercise type; do NOT scaffold or run anything before the design gates are confirmed. Also covers smoke-testing the create-exercise-service CLI/template itself, but only when explicitly asked to verify/screenshot the CLI or template. Use when asked to create/design/author/implement a new exercise type or exercise service/plugin, or to run/smoke-test the scaffolding CLI.
allowed-tools: Read, Edit, Write, AskUserQuestion, Bash(node *), Bash(pnpm *), Bash(playwright-cli *), Bash(./interactive-demo.sh*), Bash(cp *), Bash(ln *)
---

# create-exercise-type

An exercise type on this platform is a standalone **exercise-service plugin**: five JSON data types,
five REST endpoints, three iframe views. The `create-exercise-service` CLI (an interactive Node CLI
that copies `services/example-exercise` and vendors the shared exercise packages) generates ~80% of
the code; the valuable — and dangerous — 20% is the design, which is why design comes first.

Two parts. **Part A — Author a new exercise type**: three design gates with the user, then scaffold,
implement, verify. **Part B — Maintainer path**: run and smoke-test the CLI and template themselves.
Part B's drivers also serve Part A's implement/verify steps.

## Which part? (read this before doing anything)

**Default: Part A — authoring.** Assume every invocation — including bare ones ("run it", "use the
skill", the skill name alone) — means the user wants to create a new exercise type. Start the Gate 1
conversation — ask what exercise they want to build — and run **no commands at all** first, not even
prerequisite version checks: the first shell command of an authoring session belongs in the
"Implement" step, after all three gates are signed off.

**Hard rule for Part A:** until the user has explicitly confirmed all three design gates, do NOT
scaffold a project, run the `create-exercise-service` CLI or `scaffold-to.ts`, boot a dev server,
run `smoke.mjs`/`drive-view.mjs`/`interactive-demo.sh`, or create any project or temp directory.
Design sign-off gates every command.

**Part B is explicit-only.** Take the maintainer path only when the user explicitly asks to test,
verify, screenshot, or demo the *CLI or the template itself* (template drift check, CI-style
verification, "does the scaffolder still produce a bootable app?"). A request for a new exercise —
however phrased — never routes to Part B.

> Paths below are relative to the unit dir `shared-module/packages/create-exercise-service`, **except**
> `bin/create-exercise-service`, which is at the **repo root**.

---

# Part A — Author a new exercise type

The scaffold is a **complete multiple-choice exercise**, not a blank skeleton — you turn it into your
exercise type by editing the ~20% that is exercise-specific and reusing the rest. But no scaffold
exists yet, and none is created until the gates below are done.

Authoring runs through **three design gates with the user** (scope → data model → views), then
implementation, then verification. The gates are **conversations, not forms**: propose something
concrete, ask targeted questions, iterate on the answers, and proceed only on the user's **explicit
confirmation of the exact artifact shown**. Silence is not sign-off; an answer that changes anything
means you revise and **re-present the revised artifact** before moving on. `AskUserQuestion` caps at
4 questions per call — run as many rounds as the design needs rather than cramming; decompose
compound decisions (mechanism vs. catalogue vs. defaults vs. limits are *separate* questions), and
mix in free-form discussion whenever the option space is too rich for multiple choice.

**Headless / subagent context.** If `AskUserQuestion` is unavailable (you are running as a subagent,
or without an interactive user), do **not** skip a gate or sign off on your own behalf. Present the
full proposal for the gate you are at — every open question with your recommended default — as your
response, and **stop** until a human relays sign-off (possibly with tweaks). The gates are the point;
a proposed-artifact-then-stop turn honors them without an interactive prompt.

## Gate 1 — Scope: where the plugin lives, and its full feature set

**Where will the project live? Ask — never assume.** The slug/port question does not answer this;
placement is its own decision, so put it to the user explicitly:

- **Own repository** (reference/05's Track A): scaffold to a path *outside* the monorepo. The output
  is standalone (verified: fresh `pnpm install`, `tsc`, vitest, and dev-server boot all work with no
  enclosing workspace or git repo) and keeps a point-in-time vendored shared-module.
  Registered with the host later by URL (reference/05 step 9).
- **Inside this monorepo as a first-party service** (`services/<slug>`, Track B): commits you to the
  full reference/05 sequence — vendored-module sync targets (step 5), backend seed (step 6), infra
  manifests (step 7). Do only part of it and the service rots quietly.

Confirm with the user which it is *and* which of the track's obligations are in scope for this
session — "scaffold now, wire the host later" is fine, but say so out loud rather than silently
stopping early.

**Then broaden the feature list before designing anything.** The user's first message is rarely the
whole exercise. Propose the additional features this exercise class typically wants — as concrete
suggestions the user can accept or reject, not "any other requirements?" — and fold the accepted
ones into the design inputs. A feature discovered *after* the data model is locked is a migration;
five minutes of brainstorming here is the cheap alternative. Also settle scope of the template's
optional machinery now: **ask whether CSV export is wanted** (keeping it means rewriting both
handlers + tests for your data; dropping it means deleting files per reference/05 step 3 — neither
is free).

## Gate 2 — Data model: design the five types with the user (no code until confirmed)

An exercise plugin's five data types are **stored forever in a host database you cannot migrate** —
old blobs keep replaying into your endpoints and views indefinitely (a 3-year-old answer re-POSTed to
`/api/grade`, an old private spec re-opened in the editor). _The private spec is your schema; you
just don't get `ALTER TABLE`._ And the derivation from private → public spec is the anti-cheating
boundary: a field you forget to drop leaks answers into every student's browser **irreversibly** — the
spec was already served. These are the most expensive-to-get-wrong decisions in the task.

Read **`reference/07-key-design-decisions.md`** (at minimum Part I in full plus the one-screen
checklist at the end; Part II when you design the tests), then design **each of the five types in
turn** — private spec, public spec, model solution spec, answer, feedback — as its own short
conversation round:

- **Propose actual TypeScript type definitions**, not prose. Sign-off applies to the exact types
  shown; if a later answer changes them, the changed types go back to the user.
- **Doctrine-fixed items need no question** — versioning from day one, explicit-pick projections,
  migrate-on-read through one chain, server-only grading. State them as givens.
- **Real choices each need explicit confirmation**, notably: the grading model (sync/async, score
  semantics, partial credit); what the model solution shows — *including "nothing" (`null`)*, since
  peer reviewers receive it unconditionally; the answer's exact shape and what a peer reviewer will
  see in it; the validity invariants; what happens to **already-stored answers when the teacher
  later tightens the spec** (regrade policy — the doctrine's replay problem in its most concrete
  form); and how the design behaves under peer review and exam mode.
- **Every quantitative limit gets a concrete number put to the user** — file-size caps, item-count
  ceilings, character limits. "Add limits" from the user + a number you invented is not a confirmed
  design; propose the value, let them confirm or change it.
- **Delegation is not sign-off.** When the user says "you come up with X," draft X, then present the
  draft for confirmation before implementing it. Same for anything you invent post-gate.

## Gate 3 — Views: design the three UIs with the user (no view code until confirmed)

The three views are the product the teacher and students actually touch — design them deliberately,
per view, before implementing:

- **`exercise-editor`** — which control edits which private-spec field, layout, how validation
  errors surface. (Every control that affects the saved result must write to a spec field — see
  reference/07 §10.)
- **`answer-exercise`** — the answering interaction, client-side constraint feedback (what happens
  on each rejected input), and what a returning student sees seeded from `previous_submission`.
- **`view-submission`** — read-only, but triple-duty: the student's own review, **the teacher's
  preview surface, and what peer reviewers see**. Decide what renders inline vs. links out, and
  whether/how the grading result and feedback are shown.

For each view present **2–3 concrete layout options** (ASCII mockups in `AskUserQuestion` option
previews work well), state what information appears in which state (empty, filled, error, graded),
and iterate until the user explicitly confirms one. Behavior you invent during implementation that
wasn't in the confirmed design (a preview-file-types list, an inline-vs-download rule) goes back for
a quick confirm — it's part of the design, not an implementation detail.

## Implement the confirmed design

**Scaffold now — and only now.** Check the prerequisites and run the Setup install (Part B), then
scaffold non-interactively with the scriptable path, using the name/path/port confirmed in Gate 1:

```bash
pnpm --dir shared-module/packages/create-exercise-service exec tsx scripts/scaffold-to.ts <abs-path> <name> <port>
```

Immediately after scaffolding, **ship the plugin guide into the project** (do this every time). The
generated project carries no plugin/data-model documentation of its own; drop in the self-contained
guide so any agent (Claude Code, or any `AGENTS.md`-aware tool) that later opens the project
automatically loads the protocol and — most importantly — the **per-data-type allowed/disallowed
rules**. From this skill dir:

```bash
cp AGENTS_TEMPLATE.md <project>/AGENTS.md    # verbatim — the guide is service-name-agnostic
ln -s AGENTS.md <project>/CLAUDE.md          # relative symlink, so Claude Code loads the same file
```

`AGENTS_TEMPLATE.md` (alongside the drivers here) is the source of truth — a distillation of
`reference/07`: the five data types and what each may/must-not contain, the leak catalogue, and the
peer-review/exam-mode visibility surprises. Nothing needs substituting (it refers to "this service"
generically). **Keep it in sync with `reference/07`** whenever the data-model doctrine changes.

**Then read `reference/05-step-by-step-checklist.md` and follow it for your track** — it is the
mandatory sequence, not optional background: it routes the five types (`src/util/stateInterfaces.ts`)
→ the three server transforms (`src/server/{publicSpec,modelSolution,grade}.ts`; grade
**server-side only**) → the three views (keep the `IframeView`/`Renderer` skeleton) → and, for
Track B, the steps that are silently missable and rot the service if skipped (**`shared-module/
sync.ts` targets**, backend seed, infra). You change ~20% and keep ~80% verbatim — the file-by-file
change-vs-keep list is in `reference/02`; don't re-derive the layout by hand.

Authoring gotchas (each cost a real session a debugging round-trip):

- **Open files with the Read tool before editing them** — surveying via `cat` doesn't register the
  file as read, so your first `Write`/`Edit` will be rejected and you'll re-read everything.
- **Keep the template's guard rails wired, don't just keep their files**: `publicSpec.ts` /
  `modelSolution.ts` must keep *calling* `assertNoLeak` on what they serve, and every stored-blob
  door goes through the `migrate*ToLatest` chain (`src/util/migration/` in the template) — adapt
  these to your types; deleting the call sites silently disarms them.
- **Locales** live at `src/locales/<lang>/<slug>.json` (per-language dirs, file named after your
  slug); keep en/fi key sets identical.
- **The scaffold is ESM** (`type: module`): in e2e/test files use
  `path.dirname(fileURLToPath(import.meta.url))`, never `__dirname`. The tsconfig has
  `noUncheckedIndexedAccess`, so `array[0]` is `T | undefined` — index with `?.`/`!` deliberately.
- **File-upload exercises**: plugins never store files. The `useFileUpload(port)` hook
  (`@/shared-module/exercise-react/react/hooks/useFileUpload`) sends `file-upload` to the host and
  resolves to a `Map<name, url>` — the answer records the URLs. In tests the host emulator
  auto-answers uploads (`driveFileUpload` + a small committed fixture file).
- **If the answer view seeds state from `previous_submission`, emit a `current-state` for it** —
  otherwise the host's `valid` gate stays unset and a student can't resubmit unchanged prior work.

## Verify

Unit layer: `pnpm test` + `tsc --noEmit`, with the suites reference/07 Part II prescribes — envelope
tests, **leak regression gates** (including one that proves the *endpoints* invoke the guard, not
just that the guard works), round-trips, grading tables fed garbage, and a migration suite anchored
at v1.

E2E layer: adapt the inherited `e2e/protocol.spec.ts` (typed `createHostEmulator` + `set-state`
builders). **The e2e suite must be comprehensive — this is not a user preference to ask about**
(discuss test *strategy* if useful; never whether to test thoroughly). Three happy-path tests is a
smoke test, not a suite. Cover at least:

- editor: every control emits the right spec, plus the `valid` transitions (including into invalid);
- answer: the happy path *and every client-side rejection* the design defines (wrong type, over
  count/size limits, duplicates — whatever applies), removal/undo, multi-item answers,
  `previous_submission` seeding on retry;
- view-submission: rendering with answer + grading + feedback, and the degenerate cases (empty
  answer, unknown ids);
- an old-version spec fed via `set-state` emits the migrated current version.

Run it against your service (Playwright boots the dev server via `webServer`); locators must target
**rendered translated strings** ("Video files"), not i18n keys — the dev server loads real locales:

```bash
PLAYWRIGHT_CHROMIUM_PATH="$(command -v chromium)" pnpm --dir services/<your-slug> exec playwright test
```

(`drive-view.mjs` from Part B is a quick-look tool for the *example* exercise and screenshots; it is
hardcoded to the multiple-choice types, so for authoring verification the committed e2e suite above
is the loop — don't bend drive-view to your types.)

## Reference material

Bundled in **`reference/`** (start at `reference/README.md`), alongside the shipped protocol doc
`docs/plugin-system.md`:

- `01` protocol (a delta over `docs/plugin-system.md`), `02` the template's file-by-file anatomy +
  change-vs-keep list, `03` the scaffolder internals, `04` backend/infra wiring (first-party plugins).
- `05` the end-to-end checklist — **mandatory reading at the implementation step above**.
- `06` the design rationale.
- `07` the data-modelling + leak + testing deep dive — the source of the Gate-2 doctrine above.

---

# Part B — Maintainer path: run & smoke-test the CLI

For verifying the CLI and the `services/example-exercise` template themselves (template drift,
CI-style checks, screenshots of the example exercise). Everything is driven by three scripts in this
skill dir: `smoke.mjs` (scaffold + HTTP contract), `drive-view.mjs` (the iframe protocol against a
real browser), and `interactive-demo.sh` (the prompt flow). Part A's implement step also uses the
Setup and scaffold commands below.

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
cd shared-module/packages/create-exercise-service/.claude/skills/create-exercise-type
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
`createHostEmulator` wrapper instead of raw driving — see Part A's Verify step.

**Driving a text/free-input answer view.** `drive-view.mjs` demonstrates a `click` (checkbox/radio).
For an `<input>`/`<textarea>` answer (fill-in-the-blank, numeric, …), setting `.value` directly does
**not** fire React's `onChange`, so no `current-state` is emitted. Use the React-controlled-input
trick — the native value setter plus a bubbling `input` event:

```js
const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set
set.call(el, "your text")
el.dispatchEvent(new Event("input", { bubbles: true }))
```

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

## Run (scriptable / agent path)

For a **non-interactive, explicit-path** scaffold (subagents, CI, or just to skip the TTY/tmux prompt
dance), use `scripts/scaffold-to.ts` — the same `scaffoldReactProject()` the prompts drive, but
scriptable and taking an absolute path + port directly, so it sidesteps the "default path resolves
relative to the CLI dir" footgun above. `smoke.mjs` uses it internally; `reference/03` documents it.

```bash
pnpm --dir shared-module/packages/create-exercise-service exec tsx scripts/scaffold-to.ts <abs-path> <name> <port>
```

After any scaffold — maintainer or authoring — ship the plugin guide into the project (`AGENTS.md` +
`CLAUDE.md` symlink); the commands and rationale are in Part A's "Implement the confirmed design".

## Test

The CLI's own suite scaffolds into a temp dir and asserts the output (15 tests):

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
