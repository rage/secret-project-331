# The exercise-plugin protocol & architecture (the contract)

This is the contract every exercise service must satisfy, independent of language or framework. A
plugin is an **independent web application** on its own server that the host system integrates with
by (a) embedding its UIs in **sandboxed IFrames** communicating over the **Channel Messaging API**,
and (b) calling its **REST endpoints** from the backend. The host owns storage and all common
chrome; the plugin implements only the exercise-specific parts. Sources: `docs/plugin-system.md`,
`services/example-exercise` (reference impl), and the thesis (see `06-design-rationale-thesis.md`).

```
                 ┌─────────────────────── HOST SYSTEM ───────────────────────┐
   Producer ───▶ │  CMS (WYSIWYG editor)                                       │
   Consumer ───▶ │  Course material                                            │
                 │        │  embeds IFrame (Channel Messaging API)             │
                 │        │                          Backend (headless-lms)    │
                 └────────┼──────────────────────────────┼────────────────────┘
                          │ set-state / current-state     │ REST (server→server)
                          ▼                                ▼
                 ┌──────────────────── EXERCISE SERVICE (plugin) ─────────────┐
                 │  IFrame UI: editor · answer · view-submission              │
                 │  REST: service-info · public-spec · model-solution · grade │
                 └────────────────────────────────────────────────────────────┘
```

## The five data types (plugin-defined; host treats them as opaque JSON)

The plugin chooses any JSON shape for each. The host stores and passes them back but never inspects
their contents. Only the _envelopes_ are standardized.

| Type                      | Role                                                                                            | Visibility                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **`private_spec`**        | Master config: structure, grading rules, model solution. Output of the editor; stored on save.  | Teacher only — **never sent to the student's browser** |
| **`public_spec`**         | What's needed to render the answer UI, without leaking answers. Derived from `private_spec`.    | Student                                                |
| **`model_solution_spec`** | What's needed to show the model solution. Close to private_spec minus sensitive checking rules. | Student, conditionally (out of tries / full points)    |
| **`answer`**              | What the student submitted. Output of the answer view.                                          | —                                                      |
| **`grading_feedback`**    | Data to render feedback in view-submission. Returned by grade.                                  | Student, conditionally                                 |

The public/model specs being **derived** from the private spec is a deliberate anti-cheating
construct: the plugin author controls exactly what the browser ever receives, and correctness
checking stays server-side (thesis Goals 6 & 8).

## The IFrame communication protocol (Channel Messaging API)

**Handshake** (`exercise-client/client/parentConnection.ts`): the IFrame loads → posts `"ready"` to
`parent` (retrying with exponential backoff, cap 10s) → the parent transfers a `MessagePort`
(`event.ports[0]`) → the IFrame wires `port.onmessage` and stops retrying. All subsequent
communication is over that port. The vendored `useExerciseServiceParentConnection` hook does all of
this; a plugin never hand-rolls it.

**Messages** (envelope types in `exercise-protocol/core/exercise-service-protocol-types.ts`):

| Message                                                                  | Direction       | Purpose                                                                                                |
| ------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------ |
| `set-state`                                                              | Parent → IFrame | Select the view (`view_type`) and supply its input `data`. IFrame discards own state and switches.     |
| `current-state`                                                          | IFrame → Parent | Report output state changed; `{ data, valid }`. **`valid`** gates whether the host allows save/submit. |
| `height-changed`                                                         | IFrame → Parent | Content height in px so the parent resizes the IFrame (auto-sent by `HeightTrackingContainer`).        |
| `set-language`                                                           | Parent → IFrame | Preferred UI language as a BCP 47 tag; fall back to English.                                           |
| `open-link`                                                              | IFrame → Parent | Open a link in the top browsing context.                                                               |
| `request-iframe-reload`                                                  | IFrame → Parent | Ask the parent to reload the IFrame after a fatal client error.                                        |
| `open-dialog` / `dialog-response`                                        | IFrame ↔ Parent | Request a modal (confirm/warning), correlated by `requestId`.                                          |
| `file-upload` / `upload-result`                                          | IFrame ↔ Parent | Upload files via the parent.                                                                           |
| `request-repository-exercises` / `repository-exercises` / `test-results` |                 | Programming-exercise (TMC) extensions.                                                                 |

The mandatory ones for any plugin: `set-state`, `current-state`, `height-changed`, `set-language`.

## The three IFrame views (served at one URL, switched by `set-state`)

All three are rendered by one entry point (`/{base}/iframe`); `set-state.view_type` chooses which.

| View                | `view_type`       | Inputs (via set-state)                                                       | Output (via current-state) |
| ------------------- | ----------------- | ---------------------------------------------------------------------------- | -------------------------- |
| **Exercise editor** | `exercise-editor` | `private_spec` (or null for new)                                             | `private_spec`             |
| **Answer exercise** | `answer-exercise` | `public_spec`, optional prior `answer`                                       | `answer`                   |
| **View submission** | `view-submission` | `public_spec`, `answer`, optional `grading_feedback` + `model_solution_spec` | none (read-only)           |

The host renders common chrome (name, points, instructions, submit button); the view renders only the
exercise-specific portion.

## The REST endpoints (backend → plugin, server-to-server)

| Endpoint                               | Method | Input                                                                                       | Output                                           |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **service-info**                       | GET    | —                                                                                           | metadata + relative paths to all other endpoints |
| **user-interface iframe**              | GET    | —                                                                                           | the HTML that loads the IFrame UI                |
| **public-spec**                        | POST   | `SpecRequest { request_id, private_spec, upload_url }`                                      | `public_spec`                                    |
| **model-solution**                     | POST   | `SpecRequest`                                                                               | `model_solution_spec`                            |
| **grade**                              | POST   | `GradingRequest { grading_update_url, exercise_spec=private_spec, submission_data=answer }` | `GradingResult`                                  |
| **csv export** (definitions / answers) | POST   | `ExerciseServiceCsvExportRequest<T> { items: T[] }`                                         | optional; teacher data export                    |
| **status/up**                          | GET    | —                                                                                           | health check for k8s probes                      |

`service-info` is the discovery + registration seam: the backend is seeded only with this endpoint's
URL and learns all other paths from its response (see `04-backend-and-infra-integration.md`).

**`GradingResult`** (`exercise-service-protocol-types-2.ts`):

```
{ grading_progress: "FullyGraded"|"Pending"|"PendingManual"|"Failed",
  score_given, score_maximum, feedback_text, feedback_json (plugin-defined),
  set_user_variables? }
```

The generic envelopes `GradingRequest<S,D>` / `GradingResult<F>` are parameterized by the plugin with
its own spec/answer/feedback types.

## Lifecycles

**Edit & save:** CMS loads iframe → handshake → `set-state`(editor, private_spec | null) → producer
edits, plugin streams `current-state`(private_spec) → on save CMS sends private_spec to backend →
backend stores it, calls public-spec + model-solution generators, stores those.

**Answer & grade:** course material loads iframe → handshake → `set-state`(answer, public_spec) →
student interacts, plugin streams `current-state`(answer) → on submit backend saves answer, POSTs
answer + private_spec to grade → plugin returns score + feedback_json → backend computes points →
`set-state`(view-submission, answer + grading [+ model_solution]). "Try again" → `set-state`(answer)
with the previous answer.

## What "implementing a new exercise type" means, in one line

**Define 5 data types, implement 5 REST endpoints, implement 3 IFrame views speaking the 4 core
messages.** Everything else (the handshake, height reporting, error boundaries, i18n plumbing, build
& serve wiring) is provided by the vendored shared module and the template. See
`02-reference-implementation-anatomy.md` for the concrete file-by-file mapping and
`05-step-by-step-checklist.md` for the actionable sequence.
