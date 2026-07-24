# Key design decisions when building a new exercise plugin

> The SKILL's mandatory Step 0 ("Confirm the data model with the user before writing code") derives
> from the one-screen checklist at the end of this doc. Work through that checklist with the user and
> get sign-off before implementing.

The protocol (`01`) and the template (`02`) hand you the plumbing. What they _don't_ decide —
and what determines whether the plugin is still maintainable in three years — is **how you model the
five data types** and **how you test them**. This doc covers those decisions in priority order,
grounded in how `example-exercise` (clean-room ideal) and `quizzes` (battle-tested, carries years of
production data) handle them.

The core fact everything below follows from:

> **Your specs are stored forever in a database you cannot migrate.** The host treats
> `private_spec` / `public_spec` / `model_solution_spec` / answers as opaque blobs. There is no
> "run a migration over the host DB" — old blobs keep replaying into your endpoints and views
> indefinitely: a teacher opens a 3-year-old exercise in the editor, the regrader re-POSTs a
> 3-year-old answer + private spec to `/api/grade`, a re-save re-derives public specs from an old
> private spec. **The private spec is your database schema; you just don't get ALTER TABLE.**

---

## Part I — Data modelling decisions

### 1. Version your specs from day one (the single most important decision)

Quizzes learned this the hard way: its v1 specs had no version marker, so "is this old?" was long
detected by _absence_ of a field, and a whole migration layer exists to lift old blobs into the
current shape (now at `version: "3"`).

Decisions to make:

- **Put a `version` discriminant in every stored type** — private spec, public spec, model solution
  spec, _and the answer_ (quizzes versions `UserAnswer` too: `types/quizTypes/answer.ts`). The
  current quizzes private spec is literally `version: "3"`
  (`services/quizzes/types/quizTypes/privateSpec.ts`).
- **Normalize at every entry point, not in one place — but behind ONE reusable function.** Old blobs
  enter through _four_ doors and all must migrate-on-read: the public-spec endpoint, the
  model-solution endpoint, the grade path, and the editor's `set-state` handler. Quizzes routes all
  four through a single chain module (`src/util/migration/migrateToLatest.ts`, one
  `migrate*ToLatest` call per door) rather than copy-pasting a version check — see the recipe below.
- **Migrate-on-read, persist-on-save.** You can't rewrite stored blobs; you _can_ return the
  upgraded shape so the next save persists it. Internal code past the entry points should only ever
  see the current version.
- **Never delete the old types or their migration code** — `types/quizTypes/oldQuizTypes.ts` and the
  frozen per-version snapshots (quizzes: `types/quizTypes/v2.ts`) are permanent. Old private specs
  exist in the DB regardless; when you bump the version, snapshot the shape you're leaving behind so
  the previous step keeps compiling.

**Build the migration as an extensible chain from day one, not a growing pile of `if (isOld)`
branches.** Quizzes' `migrateToLatest.ts` keeps a per-blob-kind registry keyed by the version each
step _accepts_ (`{ "1": v1->v2, "2": v2->v3 }`) and a loop that applies steps until
`LATEST_QUIZ_VERSION` (in `versions.ts`, the single source of version truth via `detectQuizVersion`).
Adding v4 later is: bump `LATEST_QUIZ_VERSION`, snapshot the changed types, write the `v3->v4` step
functions, and add _one line per registry_. No door ever changes. That property — "a new migration
is a one-line registry addition" — is the point of centralizing; design for it before you have two
versions, because retrofitting it across scattered call sites is the expensive part.
`example-exercise` (and therefore every scaffolded project) ships this chain **at v1** with empty
registries — `src/util/migration/{versions,migrateToLatest}.ts` — so a new plugin retypes it rather
than building it from scratch.

**On an unknown/typo'd item type during migration, fail loud — never fabricate.** Quizzes' old v1
migrator returned a hardcoded placeholder essay (literal-string content) for unknown types, which
then got _persisted_ on the next save, silently corrupting data. Throw instead: the historical type
set is closed, so an unknown type means corrupt input, and a clear error beats corrupted data.

If you take one thing from this doc: a `version: "1"` literal field costs nothing today and is the
difference between quizzes' controlled migration chain and guessing shapes off `any`.

### 2. Design the derivation, not three independent types

`public_spec` and `model_solution_spec` are **functions of** `private_spec` — the backend calls your
generators with the private spec on every save (`pages.rs::upsert_exercise_tasks`). So don't design
three independent types; design **one master type and two projections**:

- The private spec must be a **superset**: everything needed to render (→ public), to show the
  solution (→ model solution), _and_ to grade must be in it, because grading receives only
  `exercise_spec` (= private spec) + `submission_data`.
- Think of it as a visibility lattice: `private ⊇ model_solution`, `private ⊇ public`, and
  `feedback_json` narrower still. Example-exercise's worked instance: private
  `{id,name,correct}[]` → public strips `correct` → model solution keeps only
  `{correctOptionIds}` → feedback reveals only `{selectedOptionIsCorrect}` (whether _your_ pick was
  right, not the status of every option).
- **Derivations should be pure and total**: same private spec in → same public spec out, no I/O, no
  randomness (see #4), and defined for every private spec your editor can emit (see #7). Pure
  functions here are also what makes the Part II test strategy cheap.

Anti-pattern: letting editor convenience shape the private spec (e.g. storing derived/denormalized
UI state in it). The private spec is the persisted contract; the editor can hold whatever transient
state it wants _outside_ the spec.

**Exercise types with no answer key** (file submission, essays, "upload your work" — anything where
assessment is human) still follow this design, with two shifts. First, the leak surface doesn't
disappear — it becomes *future private-only fields*, so the projections stay explicit-pick and the
leak gate asserts the public spec carries **exactly** the allowlisted keys (an exact-key-set test,
since there is no `correct` to grep for). Second, the model solution is typically `null` — a
legitimate shape, but a real decision: peer reviewers receive it unconditionally, so "nothing to
show them" must be a *confirmed* choice, not a default. Keep the endpoint (the service-info contract
needs it); return `null` from it.

### 3. Data classification: what each type may contain, who sees it when, and the leak catalogue

The derived-spec design exists (thesis Goals 6 & 8) to control information visibility. Anything that
reaches a browser is readable from devtools, no matter how it's rendered — so classify every field
before you add it. The visibility rules below are code-verified against the host, not just the docs,
because two of them (peer review, exam mode) are surprising.

#### 3a. The visibility matrix (who receives each type, and when)

| Data                                                           | Reaches whose browser                                                                                                                                                                                                                   | When (host-enforced)                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`private_spec`**                                             | Teachers/editors only (CMS editor view via `set-state`). Never students.                                                                                                                                                                | Whenever someone with edit rights opens the exercise. Also: stored plaintext in the host DB (admins), sent to your 3 server endpoints, and **cloned on course copy**.                                                                                                                                                                                                           |
| **`public_spec`**                                              | Every student viewing the exercise — in `answer-exercise` _before any answering_ and in `view-submission`. Also peer reviewers.                                                                                                         | Always. On an open MOOC, "every student" ≈ **the whole internet**. Treat as world-readable.                                                                                                                                                                                                                                                                                     |
| **`model_solution_spec`**                                      | The answering student — **only** at full points or out of tries: the server nulls it otherwise (`clear_model_solution_specs`, `controllers/course_material/exercises.rs:124-137`; same rule post-grading, `domain/exercises.rs:74-78`). | **Exception: peer reviewers receive it unconditionally** — the peer-review payload populates it regardless of the reviewer's own progress (`exercise_task_submissions.rs:564` via `peer_or_self_reviewing.rs:725`, delivered in `PeerOrSelfReviewViewImpl.tsx:311`). Cleared during ongoing exams (`clear_grading_information`), except for teachers testing with show-answers. |
| **`answer`**                                                   | The answering student (`view-submission`; and back in `answer-exercise` as `previous_submission` on retry). Teachers (submission views, CSV export). **Peer reviewers see other students' answers** (under a pseudonym).                | On every graded view / retry / review.                                                                                                                                                                                                                                                                                                                                          |
| **grading result** (`score`, `feedback_text`, `feedback_json`) | The answering student in `view-submission`. Teachers. **Peer reviewers see the reviewee's grading, incl. `feedback_json`.**                                                                                                             | Withheld during ongoing exams (`clear_grading_information`, `domain/exercises.rs:63-65`).                                                                                                                                                                                                                                                                                       |
| **`user_variables`** (from `set_user_variables`)               | The same student's own iframe views on that course instance (`AnswerExerciseIframeState`/`ViewSubmissionIframeState` in the protocol types).                                                                                            | **Blanked for peer reviewers** — the host sends `user_variables: {}` with the comment "Don't reveal peer reviewee user variables to peer reviewers in case they contain something sensitive" (`PeerOrSelfReviewViewImpl.tsx`). Still fully visible to the student themselves.                                                                                                   |
| **`user_information`**                                         | Your views get `{ pseudonymous_id, signed_in }` only — a UUIDv5 of the user id namespaced by _your service's_ id (`exercise_tasks.rs:245`).                                                                                             | You never receive real identity, and ids don't correlate across services. Don't try to collect identity into specs/answers.                                                                                                                                                                                                                                                     |

Three host behaviors worth internalizing:

- **Peer review is the great equalizer.** The moment a teacher enables it, three things you may have
  modeled as "private to one student" — the answer, the grading feedback, and the model solution —
  are shown to _other students_ who may not have solved the exercise yet. Design as if peer review
  is always on.
- **Exam mode withholds, but only grading-side data.** `clear_grading_information` strips status,
  feedback, and model solution during an ongoing exam — but the public spec still ships. Nothing in
  it can be exam-sensitive.
- **The host gates _timing_, you gate _content_.** The host decides _when_ the model solution or
  feedback reaches a student; only your generators decide _what's in them_. Don't rely on host
  timing as a secrecy mechanism — peer review already bypasses it.

#### 3b. What each type may and must not contain

- **`private_spec` — may:** everything. Correct answers, validators (regexes, tolerances, test
  rules), scoring policy, per-option feedback, model solutions — this is the master record.
  **Must not:** service secrets (API keys, credentials — every editing teacher sees them, the host
  DB stores them plaintext, course copies clone them; secrets belong in your service's env);
  student PII (specs are course _content_, copied across course instances); anything
  instance-specific that must not survive a course copy.
- **`public_spec` — may:** whatever is needed to render and interact before answering: prompts,
  option labels + ids, structure, item types, UI configuration (layout, single- vs multi-choice,
  character limits). **Must not:** correct flags, answer keys, validators, solution text, grading
  weights that hint at the answer — or anything the answer is _derivable_ from (see L2 below).
  Test: "could a motivated student with devtools and this JSON gain an advantage?"
- **`model_solution_spec` — may:** what a finished student should learn: the/an accepted answer,
  explanations. **Must not:** the _acceptance rule_ when it's broader than the shown answer — regex
  validators, numeric tolerance windows, hidden test cases, alternative accepted answers you don't
  want circulated. Per the thesis, it "lacks certain testing rules used for sensitive correctness
  checking." Show _a_ correct answer, not the checker. Assume it will be screenshotted and shared
  (and that peer reviewers get it early).
- **`answer` — may:** the student's choices/inputs by id, plus what's needed to reconstruct their
  variant (seed) if randomized. **Must not:** client-computed correctness (never trusted anyway, and
  it leaks grading logic paths); copied spec content; PII or hidden fields — **peer reviewers render
  this object**, so anything in it is shown to another student.
- **`feedback_json` / `feedback_text` — may:** feedback about _the submitted answer_, at the
  granularity you chose. **Must not:** the full answer key or the correctness of _unchosen_ options
  while retries may remain. Crucial: the `GradingRequest` contains no attempt count —
  **your grader cannot know whether the student gets another try**, so feedback must be safe assuming
  retries remain. "Reveal everything" content belongs in `model_solution_spec`, where the host's
  full-points/out-of-tries gate controls timing.
- **`set_user_variables` — may:** benign per-user-per-course state (a name the student entered, a
  chosen difficulty). **Must not:** grading internals or anything sensitive — the student sees their
  own variables in devtools on every view.

#### 3c. Catalogue of undesired leaks

- **L1 — Answer key in the public spec.** The direct form: forgetting to strip `correct` (or a new
  field that implies it) in the derivation. Example-exercise's projection exists precisely to drop
  `correct`.
- **L2 — Derivable answers.** The sneaky forms: correctness encoded in **ordering** (correct option
  always first, in authored order), in **id patterns** (sequential ids where the key is
  `option-1`), in **asymmetric metadata** (only correct options carry a `feedbackMessage` or a
  longer explanation — presence of the field is the leak), in **counts/weights** ("select exactly
  2" when the task doesn't say so; per-option point weights), or in **authoring artifacts** (casing,
  whitespace, the teacher's `TODO` notes). Shuffle or normalize these in the derivation.
- **L3 — The checker in the model solution.** Publishing the regex/tolerance/hidden tests lets
  students game the grader beyond knowing one correct answer — worse than L1 because it survives
  spec edits.
- **L4 — Oracle feedback.** `feedback_json` on a wrong attempt revealing the key (or per-option
  correctness for all options) while tries remain → iterate to full marks. Your grader can't see the
  retry policy (no attempt count in the request), so never emit more than the student's own
  submission warrants.
- **L5 — Peer-review amplification.** Anything in the answer, the feedback, or the model solution
  reaches _other students_ once peer review is on. Includes reviewee privacy: free-text answers are
  shown to peers by design — don't add hidden fields the student didn't knowingly write.
- **L6 — `user_variables` misuse.** Blanked for peers, but fully visible to the student themselves —
  no grading secrets, no "trusted client state."
- **L7 — Secrets in specs.** API keys/credentials in a private spec are visible to every editing
  teacher, stored plaintext, and cloned on course copy. Env vars, not specs.
- **L8 — Grading logic in the client bundle.** The services ship **public source maps**
  (`rsbuild.config.ts`: "Public source maps (this is open source)"). Import your grader into an
  iframe view "for client-side preview" and the entire acceptance logic ships readably to every
  student. Keep grading code strictly under `src/server/` and never import it from view code.
- **L9 — Projection by subtraction.** Building the public spec via `{...privateSpec}` +
  `delete copy.correct` means every _future_ private field leaks by default. Build projections by
  **explicit pick** (construct the object from named fields, as example-exercise's
  `map(a => ({id: a.id, name: a.name}))` does) so new fields are private until you opt them in.
- **L10 — Error/log echoes.** 400/500 bodies or server logs that echo spec fragments back; be
  deliberate about what error messages contain (the iframe already logs all port messages to the
  console by design — that's fine, it's client-visible data by definition).
- **L11 — Injection from rendered answer content.** The answer is attacker-controlled and is
  rendered to peer reviewers, so treat every answer field as untrusted input *in the view*, not just
  in classification: scheme-check any URL before using it as `href`/`src` (`http(s)` only), never
  `dangerouslySetInnerHTML` answer content, and prefer sanitizing at the answer parse boundary so
  every render site is safe by construction. A crafted `javascript:` URL rendered as an `<a href>`
  executes in a peer reviewer's iframe (a real session bug) — a stored-XSS hole general to any type
  that renders free-form answer content: essay text, filenames, URLs. Unlike L1–L10 this is an
  *inbound* injection, not an outbound information leak, but it lives in the same untrusted-boundary
  discipline.

#### 3d. Rules that make leaks structurally hard

1. **Allowlist projections** (kills L1, L2-metadata, L9): construct public/model-solution objects
   field by field; never spread-then-delete.
2. **Leak tests as regression gates** (Part II #4): walk the serialized public spec and assert
   forbidden keys/values absent — a new leaked field fails CI instead of shipping. Check forbidden
   **values** too, not just keys (answer strings, validator patterns can leak under any field name);
   quote-delimit short values when matching serialized JSON so a forbidden `"a"` doesn't
   false-positive inside a UUID. And gate the **endpoint output**, not only the guard function: a
   perfectly unit-tested `assertNoLeak` that no handler calls protects nothing — at least one test
   must POST the real endpoint and assert its response carries only allowlisted content.
3. **Server-only module discipline** (kills L8): grading and derivation code lives in `src/server/`;
   no view file imports it. Lint-able if you want (`no-restricted-imports`).
4. **Assume peer review is on** (kills L5 surprises): classify answer/feedback/model-solution as
   "visible to other students," always.
5. **Feedback ≤ submission** (kills L4): feedback may only describe the submitted answer; full
   reveals go in the model solution, whose timing the host gates.
6. **Public spec = public** : on an open MOOC, derive as if publishing to the internet — because you
   are.
7. **Render answer content as untrusted** (kills L11): scheme-check URLs before using them as
   `href`/`src`, never `dangerouslySetInnerHTML` answer fields, and sanitize at the answer parse
   boundary so every render site is safe by construction. The answer is attacker-controlled, and
   peer reviewers render it.

### 4. Mint IDs at authoring time; keep derivation deterministic

The answer references the public spec by id (`{selectedOptionId}`), and grading matches those ids
against the **private** spec. Two rules keep this correspondence intact:

- **IDs are minted in the editor** (example-exercise: `generateUuid()` when the teacher adds an
  option, `ExerciseEditor.tsx`) and flow _through_ the derivations unchanged. Never mint ids inside
  the public-spec/model-solution generators — every re-save would produce fresh ids, silently
  orphaning all previously stored answers (view-submission stops matching; regrading breaks).
- **Derivation is deterministic** — a re-save of an unchanged private spec should produce an
  equivalent public spec. If you shuffle options for anti-cheating, either shuffle in the _view_
  (per render) or derive the order from a seed stored in the private spec — never `Math.random()`
  in the generator.

### 5. Know the generation timing: specs are per-exercise-at-save-time, not per-student

The backend generates `public_spec`/`model_solution_spec` **once, when the teacher saves the page**,
and stores them. Every student receives the same public spec. Consequences:

- **No per-student randomization via the public spec.** If each student should get a different
  variant, it has to happen in the answer view (seeded client-side, with the seed or the concrete
  variant recorded _in the answer_ so grading and view-submission can reconstruct it) — or the
  exercise must be modeled so one public spec covers all variants.
- The `SpecRequest` also carries an `upload_url` (JWT-authorized) — generators may upload derived
  files, but the JSON spec they return is still static per exercise.

### 6. Model the answer as minimal, id-referencing, and self-sufficient for grading

The answer is stored per-submission forever and is the input to grading and to view-submission:

- **Reference, don't copy**: store `selectedOptionId`, not the option text. Copies go stale when the
  teacher edits the exercise, and bloat every submission row.
- ...**except** what's needed to reconstruct the student's experience when the spec has since changed
  or was randomized (see #5) — then record the variant/seed in the answer.
- **Grade must work from `private_spec + answer` alone for answer-key grading** — no session, no DB,
  no fetches; if grading needs something, it belongs in one of those two. The one exception is a
  grader that must dereference a *client-supplied* URL (file submission: download the uploaded bytes
  to scan them). That fetch is unavoidable, but the URL is attacker-controlled — treat it as hostile
  and guard it (§8, "When grading must fetch"), and expect it to force async delivery (§8), since
  network I/O rarely completes in-request.
- **Version the answer type too** (quizzes: `isOldUserAnswer`) — and make the parser actually **read
  the incoming version** and dispatch through the migration chain. A "versioned" parser that ignores
  `value.version` and stamps the current version onto whatever arrives silently *relabels* future
  blobs instead of migrating them. Old answers replay through grading during regrades and through
  view-submission forever.

### 7. Represent drafts: the `valid` flag is your validity model, parsing is not

The editor streams `current-state` on **every keystroke** (`ExerciseEditor.tsx` posts on each
change). So the private spec type must represent **half-finished exercises** — an option with an
empty name, a question with no correct answer yet. Two separate concepts, don't conflate them:

- **Parseable**: any state the editor can be in must serialize into the (versioned) private spec
  type. If "no correct answer selected" can exist on screen, it can exist in the spec.
- **Valid** (= safe to save/derive/grade): a separate judgement, reported as the `valid` boolean in
  `current-state`. The host uses it to gate saving.

Decide your invariants (≥1 option, exactly-one-correct vs at-least-one, non-empty prompt, …), encode
them in one `validate(privateSpec)` function shared by the editor (to set `valid` and show errors),
and still keep the server generators defensive — the host currently trusts `valid`, but your
endpoints shouldn't assume every stored spec passed it (older data, other writers). Two invariants
are easy to forget and bite grading later: **id uniqueness** (duplicate item ids double-count in
scoring and orphan stored answers on re-save) and **finite, in-range numeric weights** (an editor's
`Number(input)` happily yields `NaN`/`Infinity`/negatives/fractions — `score_maximum` must stay a
sane positive number).

Two related patterns worth copying:

- **Platform hard caps, enforced at both write and read.** When a teacher-configurable number must
  never exceed a platform ceiling (a max upload size, an item-count cap), enforce the ceiling in
  `validate()` *and* clamp it in the parse/migration layer — a spec stored before the cap existed
  (or written by another client) then can't smuggle an out-of-range value past the editor. The
  invariant becomes structural: a teacher *cannot* demand a 5 GB upload, whatever blob arrives.
- **The `valid` flag must reflect seeded state.** If the answer view seeds itself from
  `previous_submission` on a retry, emit a `current-state` for the seeded answer — a view that only
  emits on user interaction leaves `valid` unset, silently blocking a student who wants to resubmit
  their prior answer unchanged until they touch the form.

### 8. Choose your grading model consciously

- **Sync vs async**: return `grading_progress: "FullyGraded"` inline (example-exercise, quizzes) or
  `"Pending"` and later POST the result to the `grading_update_url` callback (the JWT-authorized
  URL in the `GradingRequest`; the tmc pattern for sandboxed test runs). Async costs you callback
  handling, retries, and a "grading in progress" state in view-submission — take it only if grading
  genuinely can't complete in-request. If you go async, satisfy this **delivery contract**, because
  the default "grade is a pure function that returns its result" no longer holds:
  1. `/api/grade` returns `Pending` immediately — no result in the response.
  2. **Exactly one terminal POST** to `grading_update_url` per job — *including when the job body
     throws*. Wrap the worker so any rejection becomes a *delivered* `Failed` result, never a
     silently-logged one: a `.catch` that builds a `Failed` and only logs it leaves the submission
     stuck.
  3. Assume the POST is retried and idempotent host-side; a retry must deliver the same terminal
     result.
  4. Design against this failure mode: a `Pending` with **no** terminal POST hangs the submission
     until a manual regrade — no host-side timeout rescues it.
  5. An in-memory retry queue is **not durable across restarts** — surface that tradeoff in Gate 1
     when async is chosen, rather than absorbing it silently.
- **Score semantics**: `score_given / score_maximum` is a ratio the host scales to the exercise's
  points. Keep `score_maximum` stable per exercise; decide partial-credit policy per item type
  (quizzes' choose-N vs multiple-choice differ) and encode the policy _in the private spec_ if
  teachers can configure it.
- **`set_user_variables`**: grading can persist per-user-per-course variables the host passes back
  to your iframe views later. Powerful (e.g. remembering a student's name across exercises) but it's
  cross-exercise hidden state — use sparingly and document each one.

**When grading must fetch (the SSRF sink).** A grader that dereferences a client-supplied URL — the
file-submission pattern, where the answer holds upload URLs and the grader downloads the bytes to
scan them — is a server-side request forgery sink: *the answer is attacker-controlled, so the URL
is too.* This is the one sanctioned exception to §6's "no fetches"; everything else grading needs
still comes from `private_spec + answer`. Guard every such fetch:

- **Validate the scheme** (`http(s)` only) before fetching.
- **Resolve the hostname and reject private/loopback/link-local ranges** and cloud-metadata
  addresses (`169.254.169.254`) — including their `::ffff:`-mapped and numeric (decimal/hex/octal)
  forms, not just the literal strings. Resolve DNS yourself and check the resolved IP; don't trust
  the name.
- **Set `redirect: "manual"` and re-validate every hop.** A permitted host can 302 you to a private
  address; following redirects unchecked defeats the guard (this was a real session bug — the check
  validated only the initial URL).
- **Cap the bytes you read** (a hard ceiling, streamed) — the same cap bounds OOM / zip-bomb
  exposure. Note that a client-claimed file size cannot be trusted; enforce the cap on bytes actually
  read.

### 9. Trust boundaries: forgiving in the iframe, strict on the server

Both inputs arrive as `unknown` — `postMessage` data in the iframe, JSON bodies on the server — but
the correct posture differs:

- **Iframe (`set-state` handling)**: parse defensively and _forgivingly_ — example-exercise's
  `parsePublicSpec`/`parseAnswer` return empty/default values on malformed fields rather than
  crashing, and `forgivingIsSetStateMessage` tolerates protocol extensions. A student mid-exam must
  not lose their work to a strict guard; degrade gracefully.
- **Server endpoints**: validate strictly and return 400 (`BadRequestError` + `jsonRoute` pattern).
  A malformed `SpecRequest`/`GradingRequest` is a bug or an attack, not a UX event. One nuance:
  grade should distinguish _malformed request envelope_ (400) from _unexpected-but-old spec/answer
  shapes_ (migrate, then grade) — regrading replays history at you, and a 500 mid-regrade is your
  bug (`Failed` grading_progress exists for genuinely ungradeable submissions).

One policy question hides inside this: **what happens to already-stored answers when the teacher
later tightens the spec?** A regrade replays an answer valid when submitted against the _current_
private spec — if grading re-checks answering-time constraints (allowed types, counts, limits)
against the new spec, narrowing the spec retroactively fails historical answers. Usually the right
policy is that answering-time constraints are answer-view UI concerns and grading does *not* re-check
them; but it is a real fairness/anti-cheating tradeoff — decide it explicitly (and with the user),
and write the decision down next to the grade function.

### 10. Every editor control must map to a spec field; model a mode/strategy as a tagged union

The private spec is the _only_ thing that gets saved. So the iron rule for the editor:

- **If a control changes what gets saved or graded, it must write to a field in the private spec —
  never to component-local React state.** Quizzes' closed-ended question shipped a
  "grading strategy" radio (exact-string vs regex) held in `useState`. It was never in the spec, so
  every reopen silently reset it, "undoing" the teacher's choice. A control's value that isn't in
  the spec does not exist. (Transient UI state that _doesn't_ affect the saved result — a preview
  toggle, which accordion is open — is fine to keep local; the test is "does it change the private
  spec?")
- **Model a "mode/strategy" selector as a discriminated union on a tag field, not as overloaded
  free-form fields.** The same closed-ended item stored only `{ validityRegex, formatRegex }` and
  _faked_ "exact string" by writing the literal answer into `validityRegex`, which grading then ran
  as a regex — so `C++`, `3.14`, `a+b` were silently mis-graded. The fix is a tagged union
  (`services/quizzes/types/quizTypes/privateSpec.ts`,
  `ClosedEndedQuestionGradingStrategy = exact-match | regex | numeric`): one `strategy` tag, each
  variant carrying exactly its own fields, and an exhaustive `switch` in grading and in every
  derivation. The union makes the persisted choice explicit and "which fields are valid right now" a
  type-level fact.
- **Don't overload one field with two meanings.** One field, one meaning. Do escaping/normalization
  in grading code (compare strings as strings), not by reinterpreting stored authoring data.
- **Make sure the model solution can show a _readable_ correct answer.** If correctness is stored
  only as an opaque matcher (a regex), there is nothing human-readable to show the student when the
  model solution is revealed. Store or derive a representative answer distinct from the checker
  (quizzes' model-solution `correctAnswerDisplayTexts`, derived per strategy; the regex _pattern_ is
  never revealed — see §3's leak rules). Deriving it is a per-strategy allowlist projection, exactly
  the shape §2 and the L9 rule below prescribe — quizzes' old model-solution derivation was a
  spread-then-delete (cast the private spec, `delete` one field), the live example L9 warns against.

### 11. Model recurring optional teacher messages as a visibility-tagged array, not one named field per moment

Feedback-to-student text tends to accrete one named field per display moment (`successMessage`,
`failureMessage`, `messageOnModelSolution`, `submitMessage`, …). Quizzes ended up with six such
fields across three scopes; each needed its own editor control (copy-pasted per item type — five
item types never even got the UI), its own migration line, and its own leak analysis, and one field
(`sharedOptionFeedbackMessage`) turned out completely dead — defined, migrated, never read.
In practice a teacher uses only one or two moments per exercise, so fixed per-moment fields are the
wrong shape. Model it instead as one array of `{ visibility, message }` with a scope-appropriate
visibility enum (quizzes: `services/quizzes/types/quizTypes/privateSpec.ts`,
`QuizFeedbackMessage` / `QuizOptionFeedbackMessage`). This gives one shared editor component
("add feedback message" → visibility dropdown + text field), additive extension (a new moment is a
new enum value, not a schema change), and a trivial model-solution projection — filter by
`on-model-solution` and carry plain strings, so after-answer text structurally cannot leak.

---

## Part II — Testing the data models and forms

The data-model decisions above are only as durable as the tests that pin them. The repo's two
services model the strategy well; here's the synthesis, ordered by value.

### 1. Test the real endpoints through the real handlers (envelope contract tests)

Both services test HTTP handlers directly, not internals: quizzes builds a tiny test client around
the handler (`tests/api/utils/appRouterTestClient.ts`, `client.post("/api/grade").send(data)`);
example-exercise unit-tests each `src/server/*.ts` handler. Assert with the shared envelope guards
(`isExerciseTaskGradingResult`) so the test fails if you drift from the backend's expected shape.
These tests double as executable documentation of your request/response envelopes.

Cover per endpoint: happy path, malformed envelope → 400, wrong content-type → 400, and (service-
info) the exact path strings — `serviceInfo.test.ts` asserts the suffix contract the backend's
discovery depends on.

### 2. Generator-based fixtures, one per exercise-type case — keep old-format generators forever

Quizzes' pattern: `tests/api/utils/privateSpecGenerator.ts` builds current-version specs and grading
requests programmatically (`generateChooseNGradingRequest`, `generateMultipleChoiceGradingRequest`,
…), and — crucially — `oldQuizGenerator.ts` builds **v1-shaped** data. Old-format generators are
frozen production-data shapes: never "updated," only added to. When you bump the spec version, the
previous version's generator joins the frozen set.

### 3. A migration test suite per stored type

Quizzes dedicates a suite to each blob type: `tests/util/migrationTests/{privateSpecMigration,
publicSpecMigration,modelSolutionSpecMigration,userAnswerMigration}.test.ts`. For each: old shape in
→ current shape out, field-by-field, including the judgement-call mappings (e.g. `migrate.ts`
choosing between `successMessage`/`failureMessage` → `messageAfterSubmissionWhenSelected`). These
let you refactor the current types fearlessly — they prove ancient data still lifts.

Start this suite at version 1 even though there's nothing to migrate yet: a test asserting "a v1
spec passes through normalization unchanged" is the anchor the v2 migration tests attach to later.

Also test the **chain entry points** themselves, not just the per-version step functions: a
versionless (v1) blob lifts all the way to the latest version in one call, an already-latest blob is
returned unchanged, an unknown/future version throws, an unknown item type throws (fail-loud, no
fabricated placeholder), and — when you add a version — every _other_ item type is deep-equal to its
prior shape (the pass-through guarantee). Quizzes: `tests/util/migrationTests/migrateToLatest.test.ts`
and `closedEndedV2ToV3.test.ts`.

Two coverage anchors a v1 suite otherwise misses. **Exercise the chain loop even at v1:** inject a
no-op (or 2-step) registry into `runChain` and assert its "did not advance the version" guard throws
— the loop body is 0% covered until you add v2, yet it is the machinery every future migration relies
on. **Test clamp-on-read for every platform hard cap (§7):** an over-cap value in a *stored* blob
must be clamped as it passes through the parse/migration layer, not merely rejected by `validate()` —
foreign or pre-cap blobs never go through `validate()`, so a cap enforced only there is not enforced
on replay.

### 4. Leak regression tests (the anti-cheating tests)

Mechanize the leak analysis from Part I #3: for every private-spec generator case, run the real
public-spec derivation, serialize the result, and assert forbidden content is absent — no `correct`
key anywhere in the JSON (walk the tree, don't just check top level), no answer strings, no
validator patterns. Do the same for model-solution against its narrower allowlist, and for
`feedback_json` per grading case. These one-line-per-field tests turn "we never leak answers" from a
hope into a regression gate. This is the class of bug you can't fix retroactively — leaked specs were
already served.

### 5. Round-trip property tests (derivation coherence)

For each generator case, test the pipeline as a whole, not just the parts:

- every id in the public spec exists in the private spec (and vice versa where required);
- an answer constructed _only from the public spec_ (as a real client would) grades successfully
  against the private spec — correct choice → full score, wrong → the policy's score;
- deriving twice from the same private spec yields equal output (determinism, #4);
- for every private spec the editor can emit (including drafts, #7), the generators don't throw.

If you add a property-testing lib this is the place; hand-rolled loops over the generator matrix are
fine too.

### 6. Grading tables: exhaustive, including garbage

Quizzes' `grade.test.ts` is the model — a table of cases per item type: correct / partially correct /
wrong / empty ("didn't select anything") / _unknown item type_ (`generateUnknownItemTypeGradingRequest`)
/ old-format request (`oldGenerateMultipleChoiceRequest`). Assert exact `score_given`, the
`grading_progress`, and the `feedback_json` shape. Malformed `submission_data` must yield a graceful
result or 400 — never a 500, because the regrader will replay whatever history contains.

### 7. Form tests: the editor's output IS the private spec

The editor is a form whose submit event is every keystroke and whose payload is your master data
type — test it at that boundary. Pattern per `IframeView.test.tsx` (Testing Library, jsdom):

- Render the view, simulate the `set-state` handshake with a fixture spec, interact (add an option,
  toggle correct, type a name), and **assert on the `current-state` messages posted to the port** —
  both `data` (the emitted private spec, deep-equal against expected) and `valid`.
- Test the `valid` transitions specifically: fresh/empty spec → `valid: false`; each Part I #7
  invariant flips it at the right moment. This is where "can save a broken exercise" bugs live.
- Feed the editor an **old-version spec** via `set-state` and assert it emits the migrated current
  version — the editor is one of the four migration doors (#1).
- Same approach for AnswerExercise (interactions → emitted answer) and ViewSubmission (given
  spec+answer+feedback fixtures → renders correct/incorrect states; wrong-id answer doesn't crash).

### 7b. Hostile client data — when grading fetches, or a view renders untrusted input

The tests above are derivation-shaped; these are adversarial. A green suite reaches "verified"
*without* them while the bug is still live — so this class is **required** whenever the answer/spec
is (a) fetched server-side or (b) rendered as `href`/`src`/markup, and you may not call those
surfaces "verified"/"fully verified" on a green `tsc`/vitest/playwright run alone.

- **SSRF is refused _and never fetched_.** Point grading at a loopback/private/metadata URL and
  assert with a *recording* fake HTTP client that the forbidden host received **no request** — a
  score-0 assertion cannot distinguish "refused" from "fetched, then failed," so it does not detect
  an SSRF regression. Cover a redirect to a private address too (permitted host → 302 →
  `169.254.169.254`).
- **Injection is neutralized at the parse boundary.** Feed the answer parser a `javascript:` /
  `data:` URL (and, if you render free text, a markup payload) and assert it is dropped/escaped
  there — so every render site is safe by construction (L11).
- **Async delivers exactly once, even on failure.** A job whose I/O throws mid-run still POSTs one
  terminal `Failed` (not a silent log); a POST that fails then succeeds recovers via retry without a
  second delivery. Assert against a fake `grading_update_url` callback.
- **Every wire-framing adapter gets its own test** — a byte scanner, an HTTP client: the framing is
  where the silent bugs hide.

### 8. Manual/E2E layer

The **Playground** (`courses.mooc.fi/playground-tabs`) exercises the full
edit → derive → answer → grade → view-submission loop against your running service — use it during
development and before releases; it surfaces protocol mistakes (height, valid-flag, view switching)
that unit tests structurally can't. In-monorepo plugins are additionally covered by the Playwright
`system-tests` suite once seeded into a course.

### The test-suite shape, summarized

```
tests/
  api/            # 1,4,5,6: endpoint contracts, leak gates, round-trips, grading tables
    utils/        # 2: privateSpecGenerator (current) + old*Generator (frozen, per version)
  migration/      # 3: one suite per stored type (private, public, model-solution, answer)
  components/     # 7: editor/answer/submission — assert emitted current-state {data, valid}
```

---

## Part III — Smaller decisions that still bite

- **The slug is forever.** It's the DB routing key (`exercise_services.slug` ==
  `exercise_tasks.exercise_type`), baked into every stored exercise task. Renaming later means data
  surgery in the _host_ DB. Pick it like a public API name.
- **Content strings vs UI strings.** Teacher-authored text (prompts, option labels, per-option
  feedback) lives _in the spec_ — it's in the course's language by construction. UI chrome ("Submit",
  "Correct!") lives in your locale files and follows `set-language` (BCP 47, English fallback).
  Don't put translatable UI strings in specs or authored content in locale files.
- **Keep the view components dumb.** The `IframeView` (state machine) / `Renderer` (dispatcher) /
  three-dumb-views split in the template is what makes form testing (#7) cheap. Views take parsed
  props and a port; all protocol handling stays in `IframeView`.
- **Height and interaction constraints.** The iframe is sandboxed and auto-resized via
  `height-changed` — design views to grow vertically rather than scroll internally, and don't rely
  on anything the sandbox denies (popups, top-navigation, downloads).
- **Feedback text vs feedback json.** `feedback_text` is host-rendered plain text; `feedback_json`
  is yours to render in view-submission. Put human summary in text, structure in json — don't smuggle
  markup through `feedback_text`. And mind the locale: the `GradingRequest` carries **no language**,
  so any `feedback_text` string ships untranslated to every course. Learner-facing feedback that must
  be localized belongs in `feedback_json`, rendered by view-submission (which follows `set-language`);
  keep `feedback_text` minimal or language-neutral.

## The one-screen checklist

Before writing the editor UI, be able to answer:

1. What is the **versioned** private-spec type, and where does its `version` field live?
2. What do the two projections drop — and did you check the derivable-answer leaks (ordering, id
   patterns, asymmetric metadata, counts/weights, authoring artifacts)? Are projections built by
   explicit pick, never spread-then-delete?
3. Is every field classified per the visibility matrix (3a) — and does the design survive **peer
   review being on** (answer, feedback, and model solution shown to other students) and exam mode
   (feedback withheld, public spec still shipped)?
4. Is `feedback_json` safe assuming retries remain (the grader can't see the attempt count), with
   full reveals living in `model_solution_spec` instead?
5. Where are ids minted? (Must be: the editor.)
6. Is derivation pure and deterministic? Where does randomization live, if any?
7. Can the answer + private spec alone produce a grade? Is the answer versioned? Does it contain
   nothing you wouldn't show a peer reviewer?
8. What are the validity invariants, and which single function encodes them?
9. Sync or async grading? What's the partial-credit policy and where is it configured?
10. Which of the four entry doors normalize old versions? (Must be: all four, via one shared
    `migrate*ToLatest` chain — and adding the next version is a one-line registry addition.)
11. Does **every editor control that affects the saved/graded result** write to a private-spec
    field (never to component-local state)? Is each mode/strategy selector a discriminated union on
    a tag, with an exhaustive switch in grading and every derivation — no single field carrying two
    meanings?
12. If correctness is stored as an opaque matcher (regex/validator), is there also a readable
    correct answer to show in the model solution?
13. Do tests exist for: envelopes, leaks, round-trips, grading tables, migrations (including
    old→latest chaining and fail-loud on unknown item types), and the editor's emitted
    `current-state`?
