# Agent guide — moocfi exercise-service plugin

This project is a **moocfi exercise-service plugin**: a standalone web app the moocfi host
(the `headless-lms` backend + the course-material / CMS frontend) integrates with. Scaffolded from
the `example-exercise` template by `create-exercise-service`, most of it is shared plumbing you keep
verbatim — you build your exercise type by editing a small, well-marked slice (five data types,
three server transforms, three views).

**Read this file before you touch the data model.** The data-type rules below are the
highest-stakes decisions here, and several are **irreversible in production**: a leaked answer key
or a badly-shaped spec was _already served / already stored_, and you cannot un-serve or migrate it.
Everything else is recoverable; these are not.

---

## How the plugin system works

A plugin is an **independent web application** on its own server. The host never runs your code
in-process; it integrates over two seams only:

1. **Sandboxed IFrames over the Channel Messaging API.** The host embeds your UI and talks to it by
   `postMessage`. The handshake (child posts `ready` → parent transfers a `MessagePort` → all
   further messages go over that port), height auto-resizing, language, dialogs and file uploads are
   **handled by the shared `exercise-*` packages** — `@moocfi/exercise-*` from npm in a project the
   published CLI scaffolded, or vendored at `src/shared-module/exercise-*` (imported as
   `@/shared-module/exercise-*`) in one scaffolded from a monorepo checkout; the deep paths after
   the prefix are identical. You never hand-roll the parent side; you render views and read/emit
   state.
2. **REST endpoints the backend calls server-to-server.** The host stores everything and calls your
   endpoints to derive specs and to grade.

The host owns all storage and common chrome (exercise name, points, instructions, submit button).
You own only the exercise-specific portion.

**The five data types.** Your plugin defines its own JSON shape for each. The host treats them as
**opaque blobs** — it stores them and hands them back but never inspects their contents. Only the
_envelopes_ (the request/response wrappers) are standardized.

**The three IFrame views**, all served from one URL (`/{base}/iframe`) and switched by
`set-state.view_type`:

| View            | `view_type`       | Gets (via `set-state`)                                      | Emits (via `current-state`)             |
| --------------- | ----------------- | ----------------------------------------------------------- | --------------------------------------- |
| Exercise editor | `exercise-editor` | `private_spec` (or null for new)                            | `private_spec` (+ `private_spec_files`) |
| Answer exercise | `answer-exercise` | `public_spec`, optional prior `answer`                      | `answer`                                |
| View submission | `view-submission` | `public_spec`, `answer`, optional feedback + model solution | none (read-only)                        |

`current-state`'s **`valid`** boolean gates whether the host lets the user save/submit.

**The REST endpoints** (backend → plugin):

| Endpoint         | In                                                                      | Out                                            |
| ---------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| `service-info`   | —                                                                       | metadata + all paths + capability flags        |
| `public-spec`    | `SpecRequest { private_spec, ... }`                                     | `public_spec` (or `{ spec, files }`)           |
| `model-solution` | `SpecRequest`                                                           | `model_solution_spec` (or `{ spec, files }`)   |
| `grade`          | `GradingRequest { exercise_spec=private_spec, submission_data=answer }` | `GradingResult`                                |
| csv export       | teacher data export                                                     | optional                                       |

The parenthesised shapes apply only when service-info sets **`declares_spec_files: true`**. Set it
if a spec ever stores host-uploaded files (example files, images in a prompt): the host cannot read a
spec, so without declarations it can never tell an in-use file from an abandoned upload and keeps
every one forever. Declaring commits you to both halves — the editor lists every referenced host
file id in `private_spec_files` on **every** `current-state` (`[]` releases them; omitting the field
leaves the last declaration standing), and both spec endpoints wrap their answer as
`{ spec, files }` with both keys present (`spec: null` for "none"). A declared id the host has no
upload for fails the whole page save; an upload nothing declares is reclaimed a week later. Off by
default, and lossless to leave off.

**Grading is server-side and normally pure.** `grade` derives its result from `exercise_spec`
(= the private spec) + `submission_data` (= the answer) alone — no DB, no network. The one exception
is a grader that must download a *client-supplied* URL (file scanning): that fetch is an SSRF sink
(see the file-upload gotcha), and such grading usually runs async — `grade` returns `Pending` and a
worker later POSTs the result to `grading_update_url`, exactly once per job.

**The anti-cheating construct.** `public_spec` and `model_solution_spec` are **derived from**
`private_spec` on every save (the backend re-runs both generators). This is deliberate: the plugin
author controls exactly what reaches a browser, and correctness checking stays server-side.
Design **one master type (the private spec) and two projections**, not three independent types.

**Don't attempt what the plugin contract forbids.** Some asks aren't hard, they're impossible here —
name why and redesign around them rather than trying. Impossible under this contract: grading that
needs a live DB, a session, or a call to another course service (grade runs from `private_spec +
answer` alone, save the one client-URL-fetch exception above); storing files in the plugin itself or
minting their IDs (the host stores answer and spec uploads and hands back IDs and URLs, so files are
available); changing a stored blob's shape in place without a version bump + a migration step
(see "your specs are stored forever" below); making view-submission depend on server-only data it
is never sent; or anything that would require the host to migrate its database.

---

## The cardinal rule: your specs are stored forever in a DB you cannot migrate

The host stores `private_spec` / `public_spec` / `model_solution_spec` / `answer` / feedback as
opaque blobs. **There is no "run a migration over the host DB."** Old blobs keep replaying into your
endpoints and views indefinitely: a teacher opens a 3-year-old exercise in the editor; the regrader
re-POSTs a 3-year-old answer + private spec to `/api/grade`; a re-save re-derives a public spec from
an old private spec. **The private spec is your database schema — you just don't get `ALTER TABLE`.**

Consequences, all enforced in this template already (`src/util/stateInterfaces.ts`):

- **Version every stored type from day one** — both specs, the model solution, the answer _and_
  `feedback_json`, which the host stores and view-submission renders for years. A `version`
  discriminant costs nothing today and is the difference between a controlled migration layer and
  guessing shapes off `any` later. This template ships `SPEC_VERSION` + `Versioned*` shapes.
- **Reject a blob with no known version.** Everything this service writes carries one, so "missing
  means v1" only lets junk through. `detectVersion` throws `MalformedBlobError`, which spec
  endpoints answer `400`, grade answers with a `Failed` result, and the views replace with a
  default. `src/util/migration/legacyBlobs.ts` lifts the template's own pre-versioning data; delete
  it, its test and its calls.
- **Migrate-on-read at every entry door, persist-on-save.** Old blobs enter through every door that
  reads them, and all must normalize old → current: each view's `set-state` handler
  (`IframeView.tsx`), the public-spec and model-solution endpoints, grade, and the CSV exports. You
  can't rewrite stored blobs, but the upgraded shape you return gets persisted on the next save.
  Parsers must actually **read the incoming `version`** and dispatch on it — a parser that stamps
  the current version onto whatever arrives silently *relabels* future blobs instead of migrating
  them.
- **Route every door through ONE migration chain, built for extension.** Keep a per-blob-kind
  registry keyed by the version each step accepts and a loop that runs steps up to the latest
  version; each door calls one `migrate*ToLatest`. Adding the next version must be a _one-line
  registry addition_ + a type snapshot — no door changes. **This template ships the chain at
  `src/util/migration/{versions,migrateToLatest}.ts`** (scaffolded at v1, registries empty) — retype
  it for your data types instead of replacing it with inline version checks.
- **On an unknown/typo'd item type while migrating, throw — never fabricate a placeholder**, which
  would get persisted on the next save and corrupt data.
- **A migration may widen what an exercise accepts, never narrow it.** Stored answers were valid
  against the old spec and a regrade replays them against the migrated one, so when a step splits
  one choice into several (one `document` category → `document`/`spreadsheet`/`presentation`), fan
  every existing choice out to all successors at their widest tier rather than guessing which was
  meant — and dedupe/normalize after the step, since fan-out can produce duplicates.
- **All stored kinds share one version, so every kind needs a step at every bump** — a `relabel`
  step (same shape, version stamped) for the kinds whose shape did not change, a real step for the
  rest. Guard the loop against a step that fails to advance the version, or it spins forever.
- **Never delete old types or their migration code**, and snapshot the shape you leave behind when
  you bump the version. Old data exists whether or not you still like its shape.

---

## What each data type MAY and MUST NOT contain

**Anything that reaches a browser is readable from devtools**, no matter how you render it. Classify
every field _before_ you add it. The template's worked example:
`Alternative { id, name, correct }[]` → public strips `correct` → model solution keeps only
`{ correctOptionIds }` → feedback reveals only `{ selectedOptionIsCorrect }`.

### `private_spec` — the master record (teachers/editors only; never students)

- **May contain:** everything. Correct answers, validators (regexes, tolerances, hidden test rules),
  scoring policy, per-option feedback, the model solution — this is the superset that everything
  else is derived from, and grading receives _only_ `private_spec + answer`.
- **Must NOT contain:** **service secrets** (API keys, credentials — every editing teacher sees the
  spec, the host stores it plaintext, and course copies clone it; secrets belong in your service's
  env vars, never a spec); **student PII** (specs are course _content_, copied across instances);
  anything instance-specific that must not survive a course copy.

### `public_spec` — world-readable (every student, before answering; also peer reviewers)

On an open MOOC "every student" ≈ **the whole internet**. Derive it as if publishing.

- **May contain:** whatever the answer UI needs before answering — prompts, option labels + ids,
  structure, item types, UI config (layout, single- vs multi-select, character limits).
- **Must NOT contain:** correct flags, answer keys, validators, solution text, weights that hint at
  the answer — **or anything the answer is _derivable_ from.** The sneaky forms (all real leaks):
  - correctness encoded in **ordering** (correct option always first / in authored order),
  - in **id patterns** (`option-1` always correct; sequential ids),
  - in **asymmetric metadata** (only correct options carry a `feedbackMessage` / a longer
    explanation — the _presence_ of the field is the leak),
  - in **counts/weights** ("select exactly 2" when the prompt doesn't say so; per-option points),
  - in **authoring artifacts** (casing, whitespace, the teacher's `TODO` notes).

  Test every field: _"could a motivated student with devtools and this JSON gain an advantage?"_

### `model_solution_spec` — shown at full points / out of tries (and to peer reviewers early)

- **May contain:** what a finished student should learn — _a_ correct answer, explanations. For
  exercise types with no answer key (file submission, essays) `null` is a legitimate shape — but
  peer reviewers receive the model solution unconditionally, so "nothing to show them" is a real
  design decision, not a default; keep the endpoint (the service-info contract needs it) and return
  `null` from it.
- **Must NOT contain:** the **acceptance rule** when it is broader than the shown answer — regex
  validators, numeric tolerance windows, hidden test cases, alternative accepted answers you don't
  want circulated. Show _a_ correct answer, not the checker. Assume it will be screenshotted and
  shared, and that peer reviewers receive it before solving.

### `answer` — the student's submission (also rendered to peer reviewers)

- **May contain:** the student's choices/inputs **by id** (store `selectedOptionId`, not the option
  text — copies go stale and bloat every row), plus the variant seed view-submission needs to render
  a randomized exercise, which grading re-derives rather than trusts (see "Other decisions").
  Grade is normally a pure function of `private_spec + answer` alone — no session, no DB, no
  fetches; **if yours fetches a client-supplied URL** (e.g. downloading an uploaded file to scan it)
  **treat it as hostile input — SSRF-guard the fetch, and expect async delivery** (see the
  file-upload gotcha and the grade note under "How the plugin system works").
- **Must NOT contain:** client-computed correctness (never trusted, and it leaks grading paths);
  copied spec content; PII or hidden fields — **peer reviewers render this object**, so anything in
  it is shown to another student.

### `feedback_json` / `feedback_text` — grading feedback (shown with the graded submission)

- **May contain:** feedback about _the submitted answer_, at the granularity you choose.
- **Must NOT contain:** the full answer key, or the correctness of _unchosen_ options, while retries
  may remain. **Crucial:** the `GradingRequest` carries **no attempt count** — your grader cannot
  know whether the student gets another try — so feedback must be safe assuming retries remain.
  "Reveal everything" content belongs in `model_solution_spec`, whose _timing_ the host gates.
  (`feedback_text` is host-rendered plain text; `feedback_json` is yours to render — don't smuggle
  markup through the text field. The `GradingRequest` also carries **no language**: strings in
  `feedback_text` ship untranslated to every course, so localized learner-facing feedback belongs in
  `feedback_json`, rendered by view-submission under `set-language`.)

### `set_user_variables` — benign per-user-per-course state (visible to the student themselves)

- **May contain:** benign state (a name the student entered, a chosen difficulty).
- **Must NOT contain:** grading internals or anything sensitive — the student sees their own
  variables in devtools on every view. Blanked for peer reviewers, but never treat it as trusted
  client state.

---

## Who sees what, when (the surprising host behaviors)

- **Peer review is the great equalizer.** The moment a teacher enables it, three things you might
  model as "private to one student" — the **answer**, the **grading feedback**, and the **model
  solution** — are shown to _other students_ who may not have solved the exercise yet. **Design as
  if peer review is always on.**
- **Exam mode withholds only grading-side data.** During an ongoing exam the host strips status,
  feedback, and model solution — but the **public spec still ships**. Nothing in the public spec can
  be exam-sensitive.
- **The host gates _timing_; you gate _content_.** The host decides _when_ the model solution or
  feedback reaches a student; your generators decide _what_ is in them. Never rely on host timing as
  a secrecy mechanism — peer review already bypasses it.
- **You never get real identity.** Views receive `{ pseudonymous_id, signed_in }` only — a per-user
  id namespaced to _your_ service, uncorrelatable across services. Don't try to collect identity
  into specs or answers.

---

## Rules that make leaks structurally hard

1. **Allowlist projections.** Build `public_spec` / `model_solution_spec` **by explicit pick** —
   construct the object from named fields (this template's `map(a => ({ id: a.id, name: a.name }))`).
   **Never `{ ...privateSpec }` then `delete copy.correct`** — spread-then-delete leaks every
   _future_ private field by default.
2. **Server-only grading discipline.** Grading and derivation live under `src/server/` and **no view
   file imports them.** This project ships **public source maps** (open source) — importing your
   grader into an iframe view "for a client-side preview" ships the entire acceptance logic,
   readably, to every student. (A generic grader whose every secret lives in the private spec, such
   as a wrapped engine's scorer, may run in the editor's preview: the code is not the secret.)
3. **Feedback ≤ submission.** Feedback may only describe the submitted answer; full reveals go in the
   model solution.
4. **Assume peer review is on** when classifying the answer, feedback, and model solution.
5. **Leak regression tests.** For every private-spec fixture, run the real derivation, serialize the
   result, and assert forbidden keys/values are absent (walk the whole tree). A newly-leaked field
   then fails CI instead of shipping — this is the one class of bug you cannot fix retroactively.
6. **Keep the guard wired, and test the endpoints, not just the guard.** `publicSpec.ts` /
   `modelSolution.ts` must keep *calling* `assertNoLeak` on what they serve (adapt its forbidden
   keys/values to your types — don't delete the call site), and at least one test must POST the real
   endpoint and assert its response carries only the allowlisted content. If your exercise has no
   answer key, the leak surface is *future private-only fields*: assert the public spec carries
   **exactly** the allowlisted key set.
7. **Render answer content as untrusted (inbound injection).** The answer is attacker-controlled and
   peer reviewers render it, so treat every answer field as untrusted *in the view*: scheme-check any
   URL before using it as `href`/`src` (`http(s)` only — a `javascript:` URL rendered as an `<a href>`
   executes in a peer reviewer's iframe), never `dangerouslySetInnerHTML` answer content, and
   sanitize at the answer parse boundary so every render site is safe by construction. Strip C0/C1
   controls and bidi overrides/isolates from text shown to teachers and reviewers, and pass every
   CSV text cell through `csvText` (the host writes cells verbatim, so `=…` runs as a formula).
8. **Errors carry no detail.** The host copies every non-2xx body into its own logs and error
   messages: `jsonRoute` answers from the fixed `ERROR_MESSAGES` and logs the detail here, and that
   detail never includes a secret (a leak guard says a value leaked, not which).

---

## Other decisions that bite

- **Every editor control that affects the saved/graded result must write to a private-spec field —
  never to component-local React state.** A control kept in `useState` is silently lost on reopen
  (quizzes' closed-ended "grading strategy" radio did this and reset on every open). Transient
  view-only state (preview toggles) may stay local.
- **Model a mode/strategy selector as a discriminated union on a tag field, with an exhaustive
  `switch` in grading and every derivation** — don't overload one free-form field with two meanings.
  (Quizzes stored a closed-ended answer as one `validityRegex` and faked an "exact string" mode by
  running a literal through `new RegExp`, silently mis-grading `C++` / `3.14`; the fix is an
  `exact-match | regex | numeric` union.) Do escaping/normalization in grading code, not in stored
  data.
- **If correctness is stored as an opaque matcher (regex/validator), also store or derive a readable
  correct answer** for the model solution — otherwise there's nothing to show the student. Derive it
  by explicit per-variant pick (never reveal the matcher itself).
- **Domain IDs are minted in the editor**, and flow through the derivations unchanged. Never mint
  domain ids inside the public-spec / model-solution generators — every re-save would produce fresh
  ids, orphaning stored answers. This does **not** apply to uploaded-file IDs: the host, not the
  editor or iframe, creates those after receiving `File[]`.
- **Derivation is pure, total, and deterministic** — same private spec in → same public spec out, no
  I/O, no `Math.random()`, and defined for _every_ spec the editor can emit (including drafts). To
  shuffle, shuffle in the derivation from a seed minted in the editor and kept in the private spec.
  A shuffle in the view hides nothing: the public spec still carries the authored order and any
  position-derived id, and a shuffle from a public seed is reversible.
- **Per-student variants: never trust a client-recorded seed** (a student can shop for an easy
  variant). Grading derives the seed from the submitter's pseudonymous id plus a per-exercise salt
  minted in the editor and kept in the private spec; check that the host's grading request carries
  `pseudonymous_user_id`, and if not, propose that platform change first. The views derive the same
  seed from `user_information.pseudonymous_id`, which is per service, so recreating the service's
  registration reassigns variants. A peer reviewer's id is their own: show a variant-dependent model
  solution only when the viewer's seed equals the answer's.
- **Parseable ≠ valid.** The editor emits `current-state` on every keystroke, so the private spec
  type must represent half-finished exercises. "Safe to save/derive/grade" is a _separate_ judgement
  reported as the `valid` flag. Encode all invariants in one `validatePrivateSpec()` (this template
  has it). Two invariants that bite grading later: **id uniqueness** and **finite, in-range numeric
  weights** (an editor's `Number(input)` happily yields `NaN`/`Infinity`/negatives). Platform hard
  caps (a max upload size, an item-count ceiling) belong in **both** `validate()` and the
  parse/migration layer (clamp on read), so no stored or foreign blob can smuggle an out-of-range
  value past the editor.
- **The `valid` flag must reflect seeded state.** If AnswerExercise seeds itself from
  `previous_submission` on a retry, emit a `current-state` for the seeded answer — emitting only on
  user interaction leaves `valid` unset and silently blocks resubmitting unchanged prior work. Merge
  the stored answer over the view's default state rather than replacing it: an answer from an
  earlier spec version can lack parts or name removed ones. And `valid` must reject whatever the
  grader would find unparseable, not just emptiness.
- **Decide the regrade-after-narrowing policy explicitly.** A regrade replays an answer that was
  valid when submitted against the _current_ private spec; if grading re-checks answering-time
  constraints (allowed types, counts, limits), a teacher tightening the spec retroactively fails
  historical answers. Usually those constraints are answer-view UI concerns and grading should not
  re-check them — but it's a fairness/anti-cheating tradeoff: decide it consciously and document it
  next to the grade function.
- **Trust boundary: forgiving in the iframe, strict on the server.** Both `postMessage` data and JSON
  bodies arrive as `unknown`, but parse `set-state` _forgivingly_ (a student mid-exam must not lose
  work to a strict guard — return empty/default on malformed fields) and validate server endpoints
  _strictly_ (`400` on a malformed envelope). Nuance for grade: distinguish a malformed request
  envelope (`400`) from an unexpected-but-old spec/answer shape (migrate, then grade). The host
  never retries a non-2xx grade — a first submission is rolled back and a regrade stored as
  failed — so an unreadable blob gets a `Failed` result, `503` means only "temporarily
  unavailable", and each part of a multi-part answer is graded in its own `try`/`catch` (a bad part
  scores 0, logged without its content).
- **Every endpoint is effectively unauthenticated**: the plugin cannot verify the host's calls. Cap
  every body as it streams (`readJsonBody`, `413`), rate-limit and bound the concurrency of expensive
  endpoints per client, and give grading a wall-clock budget with a test that grades a max-size
  answer inside it. Size the worst case against the host's 2 MiB JSON limit.
- **Grading gets no locale.** Anything it needs beyond spec and answer (the locale for a decimal
  comma, the language of server-built text) must be stored in one of them. Text the server
  builds goes out as codes plus params that the views render from the locale files;
  `src/locales/locales.test.ts` checks every code has a key and every language the same keys and
  `{{params}}`.
- **State survives only through submissions.** The host keeps no drafts and gives the iframe no exit
  hook: emit `current-state` continuously, and tell students only submitting saves.
- **Wrapping a third-party engine or format:** spike it with real teacher exports in the real host
  sandbox before designing (React/peer compatibility, bundle size, off-origin requests, whether
  grading runs in Node, whether its strip functions leak, whether its scorers trust client-reported
  status). Treat its public/strip functions as deny-lists: project through an allowlisting parser,
  fail closed, leak-check recursively. Pin anything that grades or derives specs exactly, keep a
  golden corpus (fixtures × correct/empty/garbage → points) and projection snapshots an upgrade must
  reproduce byte for byte, and record the engine version in `feedback_json`. Engine calls during spec
  derivation bound their time and concurrency inside the host's 120 s timeout and fail the whole
  request. Secrets in a container that runs untrusted input are reachable.
- **The slug is forever.** It's the DB routing key baked into every stored exercise task; renaming
  later means data surgery in the _host_ DB. Pick it like a public API name.
- **Content strings vs UI strings.** Teacher-authored text (prompts, labels, per-option feedback)
  lives _in the spec_ (it's in the course's language by construction). UI chrome ("Submit",
  "Correct!") lives in your locale files and follows `set-language`. Don't mix them.

---

## Practical gotchas (each has cost a real session a debugging round-trip)

- **Locales** live at `src/locales/<lang>/<slug>.json` — per-language directories, file named after
  the service slug. Keep the language files' key sets identical (`locales.test.ts` checks).
- **This project is ESM** (`type: module`): in Playwright/test files use
  `path.dirname(fileURLToPath(import.meta.url))`, never `__dirname`.
- **The tsconfig has `noUncheckedIndexedAccess`**: `array[0]` is `T | undefined` — index with
  `?.`/`!` deliberately.
- **Playwright locators must target rendered translated strings** ("Video files"), not i18n keys
  ("file-category-video") — the dev server loads real locale files.
- **The plugin-contract host emulator's messages are index-signatured.** `createHostEmulator`'s `messages()` /
  `waitForCurrentState` (from `exercise-service-test-utils`) return `RecordedMessage`
  (`{ message: string; [key: string]: unknown }`), so there is no typed `.data` — read the payload as
  `(msg as { data: MyType }).data`. And `noUncheckedIndexedAccess` makes `messages()[n]`
  possibly-`undefined`, so index it with `!`/`?.`.
- **Browser-test layers**: keep tests under `playwright/plugin-contract/` (typed host emulator),
  `playwright/iframe-boundary/` (sandboxed iframe at a distinct origin),
  `playwright/system/` (real-host Playground), and `playwright/fixtures/` (committed bytes). The
  emulator proves the plugin protocol only; it does not prove a real host performs an upload. A
  required failing layer means verification is incomplete; do not hide it with a skip or an emulator
  substitute.
- **File uploads**: plugins never store files or create file IDs. The `useFileUpload(port)` hook
  (`exercise-react/react/hooks/useFileUpload`) sends `file-upload` with an ordered
  `File[]` and a request-only `requestId`, then resolves to host-assigned
  `{ requestId, id, file, url }` entries. Store the returned ID and URL in the answer; never key
  uploads by filename or serialize a plugin-minted file ID. The test-utils host emulator can answer
  uploads (`driveFileUpload` + a small committed fixture file). In plugin-contract and
  iframe-boundary tests, capture the request before answering and assert the real `File[]` data:
  request id, ordering (including duplicate filenames), filename, MIME type, byte size, and SHA-256.
  Reply with distinct host IDs and prove result ordering and ID propagation; cover malformed/missing/
  extra results and host errors. A system test must inspect the real-host multipart UUID field names,
  original filenames, and the same bytes; fabricated success is not real-host proof. **If your grader
  downloads those URLs, they are attacker-controlled — an SSRF sink.** Validate the scheme
  (`http(s)` only); resolve the hostname and reject private/loopback/link-local and metadata
  (`169.254.169.254`) addresses, including `::ffff:`-mapped and numeric forms; set
  `redirect: "manual"` and re-validate every hop; cap the bytes you read (bounds OOM/zip-bomb too —
  never trust a client-claimed size). Such grading usually runs **async** (`grade` returns
  `Pending`; a worker later POSTs the result to `grading_update_url`): deliver **exactly one**
  terminal POST per job — including when the job throws (turn a rejection into a delivered `Failed`,
  never a silent log) — or the submission hangs `Pending` forever. An in-memory retry queue does not
  survive a restart.

  The host owns the multipart trust boundary: it generates UUID field names after it receives the
  iframe message, retains browser filenames as metadata, and must enforce configured count and
  streamed per-file/aggregate byte limits. Empty/non-file/missing-filename/invalid-or-duplicate UUID
  parts are rejected, and a failed batch removes all stored objects and metadata. Plugin-side limits
  are only usability checks.

- **Links and downloads**: the iframe sandbox has no `allow-popups`, so a `target="_blank"` link does
  nothing at all, a same-tab navigation would replace the exercise, and browsers ignore the `download`
  attribute for cross-origin responses — which is why an ordinary download link in a plugin looks
  broken. Ask the parent instead, via `useParentLinks(port)`
  (`exercise-react/react/hooks/useParentLinks`): `openLink(url)` posts `open-link`
  and `downloadFile({ url, filename })` posts `download-file`. Both take absolute http(s) URLs only
  (anything else throws), the host confirms with the user in its own wording before acting, and neither
  gets a reply — so render such a control as a plain action, never one that waits for an outcome. The
  suggested filename is a hint: the host strips directory components and the browser may name the file
  from the response. The plugin-contract host emulator records both messages like any other, so assert
  with `waitForMessage("download-file")` rather than on a browser download.
- **Previewing a host-stored file inline** (pdf.js, an image viewer) needs a same-origin proxy in
  this service: the platform's file endpoint is another origin that sends no CORS headers, so the
  iframe cannot `fetch()` it. That proxy fetches caller-supplied URLs, which is an SSRF sink — allow
  only origins named in an env var (the platform's origin **and** the storage host its
  `GET /api/v0/files/*` answers `302` to), proxy only the file path, re-check every redirect hop,
  stream with a byte cap, and fail closed when the variable is unset. The file-submission plugin's
  `src/server/fileProxy.ts` (`ALLOWED_FILE_ORIGINS`) is the worked shape.
- **Browser callers need a real CORS preflight.** The Playground POSTs your spec endpoints as JSON
  from the browser. `answerPreflight()` (`iframe-headers.mjs`) answers it in `server.mjs` and in
  the rsbuild dev server's `server.setup`; keep it ahead of routing in both, or the `OPTIONS`
  reaches the SPA shell or rsbuild's localhost-only CORS and the browser blocks the POST. A real
  course never hits this — headless-lms calls server-to-server — so only the Playground and browser
  tests reveal it.
- **Bundle browser libraries; load nothing from a CDN.** Libraries hard-code CDN URLs in their CSS
  and at runtime; the plugin-contract test "loads nothing from outside this service" catches them, so
  keep it pushing every view with representative content. For a code editor, import only the Monaco
  contributions you use, create its worker with `new Worker(new URL(...), { type: "module" })`,
  keep the editor uncontrolled (a controlled one drops keystrokes during fast typing), and
  `await document.fonts.load(...)` for its font before mounting — Monaco measures glyphs once.
- **A library that touches `window`/`document` as its module loads** needs `ssr: false` on the
  `/iframe` route (`src/routes/iframe.tsx`); `withNoSsr` only guards rendering, not imports.
- **Third-party widget CSS assumes its home site's globals** (the root font size, `box-sizing:
  border-box`): scope those to the widget's container, and size your own chrome in `px` so the
  widget's `rem` rules don't move it.
- **Legacy React libraries** (class widgets, `findDOMNode`, string refs) log errors on every render
  under the default client entry's `StrictMode`: add a `src/client.tsx` that hydrates without it.
  They also need `test.server.deps.inline` in `vitest.config.ts` when they import CSS/SVG, svgr's
  `exclude: /node_modules/`, and `@types/react` matching the React they pin.
- **Height tracking measures the view's own element**, so popovers, tooltips and dialogs rendered in
  a portal outside it get clipped by the iframe: reserve height for them while they are open.
- **The host's `open-dialog` answers asynchronously**, so a file picker opened after the dialog
  loses the user gesture and the browser blocks it: confirm inline instead. `useFileUpload` reports
  no progress — show an indeterminate bar and ask the student to keep the page open.
- **Rich content inside a choice row** (block HTML, maths, code): make the whole row a visually
  hidden input named with `aria-labelledby` pointing at a `div`, never wrap the content in a
  `<label>` or `<span>`, which only allow phrasing content; raise links in it above the input so
  they stay clickable.
- **Crash reports go to this service's own origin.** The template's `withErrorBoundary` only logs.
  If you switch to `exercise-react`'s reporting boundary, its reporter POSTs to `/api/v0/errors`
  relative to the iframe — this service — so add that route and forward to the platform
  (`ERRORS_BASE_URL`; the default is an in-cluster hostname). Keep it out of service-info: the host
  never calls it.
- **The production image** comes from `Dockerfile`. Every module `server.mjs` imports must be in its
  runtime `COPY` (`src/lib/dockerfiles.test.ts` checks), and anything the browser bundle reads is a
  build arg, not a runtime env var. `server.mjs` drains in-flight requests on `SIGTERM` and exits
  within 8 s, before Cloud Run's kill at 10 s, so every request and engine timeout must fit inside
  that.
- **Formatting and linting**: the platform standardized on `oxfmt` + `oxlint`; a standalone scaffold
  ships neither, so copy the monorepo root's `.oxfmtrc.json` / `.oxlintrc.json` and wire
  `format:check` + `lint:ci` into CI. Two autofixes are wrong and need a disable comment:
  `unicorn/prefer-number-coercion` rewrites `Number.parseInt("3.pdf", 10)` (`3`) to
  `Math.trunc(Number(...))` (`NaN`), and `require-await` strips an `async` that exists only to match
  a `Promise`-returning signature.

## Where each concern lives

| Concern                                             | File(s)                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| The five types, parsers, versioning, validity       | `src/util/stateInterfaces.ts`                                                           |
| Version detection and the migration chain           | `src/util/migration/{versions,migrateToLatest}.ts`                                      |
| Error bodies, body caps                             | `src/lib/apiRoutes.ts`                                                                  |
| Production server, SIGTERM drain, image             | `server.mjs`, `graceful-shutdown.mjs`, `iframe-headers.mjs`, `Dockerfile`               |
| Locale key and code coverage                        | `src/locales/locales.test.ts`                                                           |
| The three server transforms (grade **server-only**) | `src/server/{publicSpec,modelSolution,grade}.ts`                                        |
| service-info (path contract), CSV export            | `src/server/serviceInfo.ts`, `src/server/export{Definitions,Answers}.ts`                |
| The state machine / dispatcher / three views        | `src/components/{IframeView,Renderer,ExerciseEditor,AnswerExercise,ViewSubmission}.tsx` |
| Generic host↔plugin envelopes (do not edit)         | `@moocfi/exercise-protocol/...` (npm) or `src/shared-module/exercise-protocol/...`      |
| Plugin protocol contract (typed host emulator)      | `playwright/plugin-contract/`                                                           |
| Sandboxed distinct-origin iframe boundary            | `playwright/iframe-boundary/`                                                           |
| Real-host Playground system coverage                 | `playwright/system/`                                                                    |
| Browser fixture bytes                                | `playwright/fixtures/`                                                                  |

Extend this table with this exercise type's own modules, environment variables and fixture rules as
you add them, so the next session finds them without a search.

## When you change the data model

Before writing editor UI, be able to answer: (1) the **versioned** private-spec type and where
`version` lives; (2) what the two projections drop, checked against the derivable-answer leaks, built
by explicit pick; (3) every field classified by visibility, surviving peer-review-on and exam mode;
(4) `feedback_json` safe assuming retries remain; (5) domain ids minted in the editor and upload IDs
minted only by the host; (6) derivation pure & deterministic, every seed private or derived
server-side; (7) answer gradeable from private spec alone, versioned, safe to show a peer reviewer;
(8) the single `validate()` and its invariants; (9) sync vs async grading + partial-credit policy;
(10) all five stored kinds versioned, and every door migrates old versions through one chain where
a new version is a one-line registry addition; (11) every editor control that affects the saved
result writes to a spec field (not local state), and each mode/strategy is a tagged union — no field
with two meanings;
(12) a readable model-solution answer exists even when correctness is an opaque matcher; (13) tests
for envelopes, leaks, round-trips, grading tables, migrations (old→latest chaining + fail-loud on
unknown item types), and the editor's emitted `current-state`.

> In the moocfi monorepo there is more depth: `docs/plugin-system.md` (the canonical protocol prose)
> and the `create-exercise-service` skill's `reference/` (especially `07-key-design-decisions.md`,
> the source of the rules above). A standalone generated project does not carry those — this file is
> the self-contained distillation.
