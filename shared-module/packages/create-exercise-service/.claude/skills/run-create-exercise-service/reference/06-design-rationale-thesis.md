# Design rationale (from the master's thesis)

Source: the master's thesis behind this plugin system (an external document, not part of this repo) —
chapters `01-introduction`, `03-goals`, `03-lms-and-smart-learning-content`, `02-extensibility-web`,
`04-solution`, `09-appendix`. The thesis documents _why_ the plugin system is shaped the way it is.
Quotes are verbatim (original typos preserved). This is the "why" behind the "how" in the other
files.

## The problem: scaling exercise-type development

The UH MOOC Center built its own LMS, hosting "multiple-choice questions, essays, and programming
assignments," and is expanding to more courses/departments — driving demand for more exercise types
than the core team can build. Two explicit **needs** drive everything:

- **"Need 1: Independent teams should be able to work on new exercise types concurrently."**
- **"Need 2: A misbehaving plugin should not break or disrupt the system it is running on."**

The **old architecture** is the foil: each exercise was a separate, self-contained service that
owned its own editing UI, grading, _and_ its own data (submissions, points), with a separate
points-aggregator. Consequences: heavy duplication (admin UIs, points handling, storage), and every
new cross-cutting feature had to be re-implemented per service. The concrete pain: peer review was
built only for essays, then wanted for programming exercises, but lived in a different service.

A deliberate goal: teams add content "without the involvement of the core development team or the
administrators." They chose to build their own plugin system rather than reuse Moodle's "due to
their reliance on the underlying system's implementation details" — avoiding coupling to host
internals is first-class.

## Why microfrontends / sandboxed IFrames

Chapter 2 surveys and rejects alternatives:

- **Monkey patching / in-process plugins**: powerful but the author must learn host internals, and
  "changes to the host program easily breaks the plugins." Untrusted in-process code is the root
  security problem — even isolated plugins "can still consume resources" (CPU/memory) and jam/crash
  the host. The stated fix: "move the plugin to be run on a different process than the host program"
  — or a different computer.
- **Frontend techniques** (templating, script tags): risk CSS/UI interference. Shadow DOM isolates
  styles.
- **IFrames** win because they add sandboxing on top of style isolation: the `sandbox` feature
  "prevents the contents of the IFrame from modifying the page it is included on... This possibility
  is not available in any of the previously mentioned extending options."
- **Micro frontends** are the framing pattern (microservices applied to the frontend) whose key
  benefit is letting multiple teams work independently. Acknowledged cost: more code to
  download/execute (slower pages), more system complexity.

**Prior art anchor:** the A+ system / Karavirta et al. The solution "adopted Karavirta et al.'s
approach of making the plugins services, and having the host system handle common functionality."
The improvement over A+ is better extensibility of the different **frontend view types** (editor /
answer / submission) per content kind.

## Host vs plugin: terminology & the opaque-blob principle

- **Host system**: the software being extended. Here it has two frontends — the **CMS** (WYSIWYG
  page editor, used by producers) and **course material** (used by consumers) — plus a backend that
  owns all storage.
- **Plugin = exercise service**: an independent web app on its own server, exposing HTTP endpoints
  and IFrame UIs.
- **Actors**: **Producer** (creates content, e.g. a teacher, doesn't program), **Consumer**
  (student), **Core system developer** (builds the host), **Smart learning content developer**
  (builds the plugin), **Administrator** (runs servers). The two developer roles are deliberately
  separate: "the people developing the smart learning content do not have to be the same ones who
  are developing the host system."

**The opaque-blob principle (central):** "Storing data is handled by the host program. Plugins send
their internal data to the host program for storage, which is then given back when needed. The host
system treats the internal data of the plugins as an opaque blob. Its structure is unknown to it,
and it lacks the ability to modify the data independently." The plugin owns the _meaning_ of its
data; the host is a generic container.

## The eight design goals (and what they force on a plugin author)

| Goal | Statement (paraphrase)                                                                                                                                                  | Consequence for a plugin                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1    | New exercise types "not complex but still fully integrated"; cross-cutting features (peer review) work "without requiring the exercise types to explicitly support it." | Don't reimplement host concerns — inherit them.                                                                                 |
| 2    | Must be impossible to build a type "tightly coupled to the core."                                                                                                       | Plugin speaks only the fixed data-type + message + endpoint contract; never touches host internals.                             |
| 3    | Exercises embeddable/answerable in course material.                                                                                                                     | The answer view.                                                                                                                |
| 4    | Answering UI interactive, "much like in single-page applications."                                                                                                      | Rich client-side view.                                                                                                          |
| 5    | Consumers get automated feedback.                                                                                                                                       | The grade endpoint.                                                                                                             |
| 6    | "I should not be able to falsify the correctness of my answers by modifying the frontend... verify... on server-side to prevent cheating."                              | Grading is a server→server HTTP call using the private spec; **never** in the browser; private spec never sent to the consumer. |
| 7    | Producer configures "from the same interface from where I'm creating content."                                                                                          | Editor view is a micro-frontend inside the CMS.                                                                                 |
| 8    | "A plugin that is not behaving properly should not be able to cause the host system to crash or to compromise... safe... to add... without a review."                   | Two-layer isolation (below).                                                                                                    |

Mapping: Goals 1 & 2 → Need 1; Goal 8 → Need 2; Goals 1/3/4/5/7 → practical implementability.

## The two-layer isolation story (what a plugin can rely on / must respect)

- **Process/host isolation**: the plugin is a separate service on a separate server — resource
  exhaustion or crashes are contained (Goal 8 / Need 2).
- **Browser isolation**: the UI runs in a sandboxed IFrame, style-isolated and unable to modify the
  host page.
- **Restricted communication**: "Communication between the plugins and the host system is restricted
  to specified means only" — the fixed message protocol and the fixed HTTP endpoints.
- **No plugin-side storage**: the host owns storage, treats plugin data as opaque JSON.
- **Mandatory server-side grading**, and the correctness config (private spec) must never reach the
  consumer. The author decides, via the public/model-solution generators, exactly what consumers
  see.
- Author responsibilities: implement **BCP 47 language handling** (respond to `set-language`, fall
  back to English), report **height-changed** for correct resizing, and set the `current-state`
  **valid** flag correctly so the host knows when saving/submitting is allowed.

## Why the private spec spawns two derived specs (a security construct, not just modeling)

- **Private spec** — master type: full config (structure, grading rules, model solution). Output of
  the editor, stored on save, **never exposed to consumers**.
- **Public spec** — "The information that is needed to render the user interface where the consumer
  can start solving an exercise. Does not leak the correct answer or the model solution."
- **Model solution spec** — "typically very close to the private spec, but lacks certain testing
  rules used for sensitive correctness checking that we cannot share with the consumers." Shown when
  a consumer runs out of tries or gets full points.

Rationale: "If consumers had access to the full configuration, cheating could be easier in certain
exercises. Thus, this plugin system never exposes the private spec to the consumer, allowing the
plugin author to choose what information the consumers can see." The multiple-choice worked example
(Appendix A): private = options `{id,label,correct}`; public = same with `correct` stripped; model
solution = `{id,correct}` (labels dropped, correctness kept); answer = `{selectedOptionId}`; grading
feedback = `{selectedOptionIsCorrect}` (narrower than the model solution — reveals only whether _your_
choice was right). This is exactly what `services/example-exercise` implements.

## Lifecycle (the two scenario sequence diagrams)

**Editing & saving** (producer in CMS): CMS loads iframe → port handshake → `set-state`
(exercise-editor, with saved private spec or `null`) → producer edits, plugin streams `current-state`
(updated private spec) → save: CMS sends private spec to backend → backend stores it, calls the
public-spec and model-solution generators, stores those too.

**Answering & grading** (consumer in course material): iframe loads → handshake → `set-state`
(answer-exercise, with public spec) → consumer interacts, plugin streams `current-state` (answer) →
submit: course material sends answer to backend → backend saves + POSTs answer **+ private spec** to
the grade endpoint → plugin returns a **correctness coefficient (0–1)** + grading feedback → backend
computes points → `set-state` (view-submission, with answer, grading, optionally model solution). On
"try again," `set-state` (answer-exercise) again **with the previous answer** to resume.

## Implementing a new type = three definitional lists + a dev tool

The thesis has no numbered tutorial; "what it entails" is: **define 5 data types, implement 5 HTTP
endpoints, implement 3 IFrame views speaking the 4-message protocol.** The developer on-ramp is the
**Playground** (courses.mooc.fi/playground-tabs), built "to make it easier to create new exercises."
You enter your plugin's **service-info URL** (same registration mechanism as the real host); it
previews all specs and all three views in an iframe that "works exactly the same way as the
implementation of the plugin system in the LMS," shows the latest `current-state`, and can derive
public/model specs from a private spec and produce a grading — exercising the full
edit→derive→answer→grade→view lifecycle on one page.

## Threads worth carrying forward

- **Opaque-blob storage + host-owned common functionality** delivers Goal 1 (full integration,
  cross-cutting features for free) and Goal 2 (no coupling).
- **Private-spec-as-master with two derived specs is fundamentally an anti-cheating construct**
  (Goals 6 & 8), letting the author control exactly what a browser ever receives and forcing
  correctness checks server-side.
- **IFrame sandbox + separate service on a separate server** is the two-layer isolation that lets
  untrusted plugins be added without review (Goal 8 / Need 2).
- **Service-info-URL registration** is the seam enabling third-party, self-service plugin addition
  without administrator involvement.
