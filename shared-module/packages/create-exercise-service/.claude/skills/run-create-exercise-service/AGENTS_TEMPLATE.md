# Agent guide — moocfi exercise-service plugin

This project is a **moocfi exercise-service plugin**: a standalone web app that the moocfi host
(the `headless-lms` backend + the course-material / CMS frontend) integrates with. It was scaffolded
from the `example-exercise` template by `create-exercise-service`, so most of it is shared plumbing
you keep verbatim — you build your exercise type by editing a small, well-marked slice (the five
data types, the three server transforms, the three views).

**Read this file before you touch the data model.** The data-type rules below are the
highest-stakes decisions in the project, and several are **irreversible in production**: a leaked
answer key or a badly-shaped spec was _already served / already stored_, and you cannot un-serve or
migrate it. Everything else in the codebase is recoverable; these are not.

---

## How the plugin system works

A plugin is an **independent web application** on its own server. The host never runs your code
in-process; it integrates over two seams only:

1. **Sandboxed IFrames over the Channel Messaging API.** The host embeds your UI and talks to it by
   `postMessage`. The handshake (child posts `ready` → parent transfers a `MessagePort` → all
   further messages go over that port), height auto-resizing, language, dialogs and file uploads are
   **handled by the vendored shared module** (`src/shared-module/exercise-*`). You never hand-roll
   the parent side; you render views and read/emit state.
2. **REST endpoints the backend calls server-to-server.** The host stores everything and calls your
   endpoints to derive specs and to grade.

The host owns all storage and common chrome (exercise name, points, instructions, the submit
button). You own only the exercise-specific portion.

**The five data types.** Your plugin defines its own JSON shape for each of these. The host treats
them as **opaque blobs** — it stores them and hands them back but never inspects their contents.
Only the _envelopes_ (the request/response wrappers) are standardized.

**The three IFrame views**, all served from one URL (`/{base}/iframe`) and switched by
`set-state.view_type`:

| View            | `view_type`       | Gets (via `set-state`)                                      | Emits (via `current-state`) |
| --------------- | ----------------- | ----------------------------------------------------------- | --------------------------- |
| Exercise editor | `exercise-editor` | `private_spec` (or null for new)                            | `private_spec`              |
| Answer exercise | `answer-exercise` | `public_spec`, optional prior `answer`                      | `answer`                    |
| View submission | `view-submission` | `public_spec`, `answer`, optional feedback + model solution | none (read-only)            |

`current-state`'s **`valid`** boolean gates whether the host will let the user save/submit.

**The REST endpoints** (backend → plugin):

| Endpoint         | In                                                                      | Out                   |
| ---------------- | ----------------------------------------------------------------------- | --------------------- |
| `service-info`   | —                                                                       | metadata + all paths  |
| `public-spec`    | `SpecRequest { private_spec, ... }`                                     | `public_spec`         |
| `model-solution` | `SpecRequest`                                                           | `model_solution_spec` |
| `grade`          | `GradingRequest { exercise_spec=private_spec, submission_data=answer }` | `GradingResult`       |
| csv export       | teacher data export                                                     | optional              |

**The anti-cheating construct.** `public_spec` and `model_solution_spec` are **derived from**
`private_spec` on every save (the backend re-runs both generators). This is deliberate: the plugin
author controls exactly what ever reaches a browser, and correctness checking stays server-side.
Design **one master type (the private spec) and two projections**, not three independent types.

---

## The cardinal rule: your specs are stored forever in a DB you cannot migrate

The host stores `private_spec` / `public_spec` / `model_solution_spec` / `answer` / feedback as
opaque blobs. **There is no "run a migration over the host DB."** Old blobs keep replaying into your
endpoints and views indefinitely: a teacher opens a 3-year-old exercise in the editor; the regrader
re-POSTs a 3-year-old answer + private spec to `/api/grade`; a re-save re-derives a public spec from
an old private spec. **The private spec is your database schema — you just don't get `ALTER TABLE`.**

Consequences, all enforced in this template already (`src/util/stateInterfaces.ts`):

- **Version every stored type from day one.** A `version` discriminant costs nothing today and is
  the difference between a controlled migration layer and guessing shapes off `any` later. This
  template ships `SPEC_VERSION` + `Versioned*` shapes.
- **Migrate-on-read at every entry door, persist-on-save.** Old blobs enter through _four_ doors and
  all must normalize old → current: the editor's `set-state` handler (`IframeView.tsx`), the
  public-spec endpoint, the model-solution endpoint, and grade. You can't rewrite stored blobs, but
  the upgraded shape you return gets persisted on the next save.
- **Never delete old types or their migration code.** Old data exists whether or not you still like
  its shape.

---

## What each data type MAY and MUST NOT contain

This is the core of the plugin. **Anything that reaches a browser is readable from devtools**, no
matter how you render it. Classify every field _before_ you add it. The template's worked example:
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

- **May contain:** what a finished student should learn — _a_ correct answer, explanations.
- **Must NOT contain:** the **acceptance rule** when it is broader than the shown answer — regex
  validators, numeric tolerance windows, hidden test cases, alternative accepted answers you don't
  want circulated. Show _a_ correct answer, not the checker. Assume it will be screenshotted and
  shared, and that peer reviewers receive it before solving.

### `answer` — the student's submission (also rendered to peer reviewers)

- **May contain:** the student's choices/inputs **by id** (store `selectedOptionId`, not the option
  text — copies go stale and bloat every row), plus whatever is needed to reconstruct their variant
  (a seed) if the exercise is randomized. Grade must work from `private_spec + answer` alone — no
  session, no DB, no fetches.
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
  markup through the text field.)

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
   readably, to every student.
3. **Feedback ≤ submission.** Feedback may only describe the submitted answer; full reveals go in the
   model solution.
4. **Assume peer review is on** when classifying the answer, feedback, and model solution.
5. **Leak regression tests.** For every private-spec fixture, run the real derivation, serialize the
   result, and assert forbidden keys/values are absent (walk the whole tree). A newly-leaked field
   then fails CI instead of shipping — this is the one class of bug you cannot fix retroactively.

---

## Other decisions that bite

- **IDs are minted in the editor**, and flow through the derivations unchanged. Never mint ids inside
  the public-spec / model-solution generators — every re-save would produce fresh ids, orphaning all
  stored answers.
- **Derivation is pure, total, and deterministic** — same private spec in → same public spec out, no
  I/O, no `Math.random()`, and defined for _every_ spec the editor can emit (including drafts). If
  you shuffle for anti-cheating, shuffle in the _view_ or from a stored seed, not in the generator.
- **Parseable ≠ valid.** The editor emits `current-state` on every keystroke, so the private spec
  type must represent half-finished exercises. "Safe to save/derive/grade" is a _separate_ judgement
  reported as the `valid` flag. Encode all invariants in one `validatePrivateSpec()` (this template
  has it). Two invariants that bite grading later: **id uniqueness** and **finite, in-range numeric
  weights** (an editor's `Number(input)` happily yields `NaN`/`Infinity`/negatives).
- **Trust boundary: forgiving in the iframe, strict on the server.** Both `postMessage` data and JSON
  bodies arrive as `unknown`, but parse `set-state` _forgivingly_ (a student mid-exam must not lose
  work to a strict guard — return empty/default on malformed fields) and validate server endpoints
  _strictly_ (`400` on a malformed envelope). Nuance for grade: distinguish a malformed request
  envelope (`400`) from an unexpected-but-old spec/answer shape (migrate, then grade) — a `500`
  mid-regrade is your bug.
- **The slug is forever.** It's the DB routing key baked into every stored exercise task; renaming
  later means data surgery in the _host_ DB. Pick it like a public API name.
- **Content strings vs UI strings.** Teacher-authored text (prompts, labels, per-option feedback)
  lives _in the spec_ (it's in the course's language by construction). UI chrome ("Submit",
  "Correct!") lives in your locale files and follows `set-language`. Don't mix them.

---

## Where each concern lives

| Concern                                             | File(s)                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| The five types, parsers, versioning, validity       | `src/util/stateInterfaces.ts`                                                           |
| The three server transforms (grade **server-only**) | `src/server/{publicSpec,modelSolution,grade}.ts`                                        |
| service-info (path contract), CSV export            | `src/server/serviceInfo.ts`, `src/server/export{Definitions,Answers}.ts`                |
| The state machine / dispatcher / three views        | `src/components/{IframeView,Renderer,ExerciseEditor,AnswerExercise,ViewSubmission}.tsx` |
| Generic host↔plugin envelopes (do not edit)         | `src/shared-module/exercise-protocol/...`                                               |
| Protocol e2e (typed host emulator)                  | `e2e/protocol.spec.ts`                                                                  |

## When you change the data model

Before writing editor UI, be able to answer: (1) the **versioned** private-spec type and where
`version` lives; (2) what the two projections drop, checked against the derivable-answer leaks, built
by explicit pick; (3) every field classified by visibility, surviving peer-review-on and exam mode;
(4) `feedback_json` safe assuming retries remain; (5) ids minted in the editor; (6) derivation pure &
deterministic; (7) answer gradeable from private spec alone, versioned, safe to show a peer reviewer;
(8) the single `validate()` and its invariants; (9) sync vs async grading + partial-credit policy;
(10) all four doors migrate old versions; (11) tests for envelopes, leaks, round-trips, grading
tables, migrations, and the editor's emitted `current-state`.

> In the moocfi monorepo there is more depth: `docs/plugin-system.md` (the canonical protocol prose)
> and the `create-exercise-service` skill's `reference/` (especially `07-key-design-decisions.md`,
> the source of the rules above). A standalone generated project does not carry those — this file is
> the self-contained distillation.
