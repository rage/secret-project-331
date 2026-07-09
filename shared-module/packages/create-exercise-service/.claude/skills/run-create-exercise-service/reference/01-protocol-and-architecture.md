# The exercise-plugin protocol & architecture (the contract)

**This file is a delta over the shipped `docs/plugin-system.md`.** That doc is the canonical prose
description of the protocol (message summary, the three views, the REST endpoints, example
scenarios); read it first. This file adds what it omits and an agent needs: the architecture at a
glance, the handshake mechanics, the **code locations** of each contract, and the **exact TypeScript
shapes** of the envelopes/specs/grading. Where the two overlap, `docs/plugin-system.md` wins — don't
treat the summaries here as a second source of truth.

A plugin is an **independent web application** on its own server that the host integrates with by
(a) embedding its UIs in **sandboxed IFrames** over the **Channel Messaging API**, and (b) calling
its **REST endpoints** from the backend. The host owns storage and all common chrome. Sources:
`docs/plugin-system.md`, `services/example-exercise` (reference impl), and `06-design-rationale-thesis.md`.

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

**Messages.** `docs/plugin-system.md` has the full From/To/Description table. The enrichments:

- Envelope types live in `exercise-protocol/core/exercise-service-protocol-types.ts` —
  `MessageToIframe` (parent → iframe: `set-state`, `set-language`, `upload-result`,
  `dialog-response`, `repository-exercises`, `test-results`) and `MessageFromIframe` (iframe →
  parent: `current-state`, `height-changed`, `open-link`, `open-dialog`, `file-upload`,
  `request-iframe-reload`, `request-repository-exercises`).
- The mandatory four for any plugin: `set-state`, `current-state`, `height-changed`, `set-language`.
  `current-state`'s **`valid`** flag gates whether the host allows save/submit. `height-changed` is
  auto-sent by the vendored `HeightTrackingContainer`. Request/response pairs (`open-dialog`/
  `dialog-response`, `file-upload`/`upload-result`) correlate by `requestId`.

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

The two end-to-end sequences (edit & save; answer & grade) are in `docs/plugin-system.md`'s "Example
Scenarios" (and `06`'s lifecycle section). The one non-obvious beat: on save the backend re-derives
**both** the public spec and the model solution from the private spec and stores them, so those
generators run on every save — keep them pure and total (`07` §2).

## What "implementing a new exercise type" means, in one line

**Define 5 data types, implement 5 REST endpoints, implement 3 IFrame views speaking the 4 core
messages.** Everything else (the handshake, height reporting, error boundaries, i18n plumbing, build
& serve wiring) is provided by the vendored shared module and the template. See
`02-reference-implementation-anatomy.md` for the concrete file-by-file mapping and
`05-step-by-step-checklist.md` for the actionable sequence.
