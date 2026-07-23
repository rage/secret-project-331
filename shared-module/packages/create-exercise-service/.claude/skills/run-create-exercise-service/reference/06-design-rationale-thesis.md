# Design rationale (from the master's thesis)

Source: the master's thesis behind this plugin system (an external document, not part of this repo).
This is the "why" behind the "how" in the other files — only the parts that change what a plugin
author decides. Quotes are verbatim (original typos preserved).

## The two needs that drive everything

The UH MOOC Center built its own LMS and needs more exercise types than the core team can build:

- **"Need 1: Independent teams should be able to work on new exercise types concurrently."**
- **"Need 2: A misbehaving plugin should not break or disrupt the system it is running on."**

The old architecture is the foil: each exercise was a self-contained service owning its own editing
UI, grading, _and_ data — so every cross-cutting feature (peer review, points) was re-implemented per
service. The fix is a plugin system where the host owns storage and all common functionality, and
plugins are sandboxed iframes on separate servers (Need 2's two-layer isolation: a crash/leak is
contained by both the process boundary and the iframe `sandbox`).

## The opaque-blob principle (central)

> "The host system treats the internal data of the plugins as an opaque blob. Its structure is
> unknown to it, and it lacks the ability to modify the data independently."

The plugin owns the _meaning_ of its data; the host is a generic container that stores it and hands
it back. This is why versioning and migration are the plugin's problem (see `07`), and why the host
can add cross-cutting features without every type explicitly supporting them.

## The eight design goals (and what each forces on a plugin author)

| Goal | Statement (paraphrase)                                                                                                                     | Consequence for a plugin                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1    | New types "not complex but still fully integrated"; cross-cutting features (peer review) work "without requiring the types to support it." | Don't reimplement host concerns — inherit them.                                                                         |
| 2    | Must be impossible to build a type "tightly coupled to the core."                                                                          | Plugin speaks only the fixed data-type + message + endpoint contract; never touches host internals.                     |
| 3    | Exercises embeddable/answerable in course material.                                                                                        | The answer view.                                                                                                        |
| 4    | Answering UI interactive, "much like in single-page applications."                                                                         | Rich client-side view.                                                                                                  |
| 5    | Consumers get automated feedback.                                                                                                          | The grade endpoint.                                                                                                     |
| 6    | "I should not be able to falsify the correctness of my answers by modifying the frontend... verify... server-side to prevent cheating."    | Grading is a server→server call using the private spec; **never** in the browser; private spec never sent to a student. |
| 7    | Producer configures "from the same interface from where I'm creating content."                                                             | Editor view is a micro-frontend inside the CMS.                                                                         |
| 8    | "A plugin that is not behaving properly should not be able to... crash or compromise [the host]... safe... to add... without a review."    | Two-layer isolation (process + iframe sandbox).                                                                         |

Mapping: Goals 1 & 2 → Need 1; Goal 8 → Need 2; Goals 1/3/4/5/7 → practical implementability.

## Why the private spec spawns two derived specs (a security construct, not just modelling)

> "If consumers had access to the full configuration, cheating could be easier in certain exercises.
> Thus, this plugin system never exposes the private spec to the consumer, allowing the plugin author
> to choose what information the consumers can see."

- **Private spec** — master type: full config (structure, grading rules, model solution). Stored on
  save; **never exposed to consumers**.
- **Public spec** — "the information needed to render the UI where the consumer can start solving...
  Does not leak the correct answer or the model solution."
- **Model solution spec** — "typically very close to the private spec, but lacks certain testing
  rules used for sensitive correctness checking." Shown at full points / out of tries.

The thesis's multiple-choice worked example (Appendix A) illustrates the pattern: private options
carry the correct flag → public strips it → the model solution keeps only the correct ids → the
answer references the chosen id → feedback reveals only whether _your_ choice was right (narrower than
the model solution). `services/example-exercise` implements this pattern; for its exact shapes
(`{id,name,correct}` → `{correctOptionIds}` → `{selectedOptionId}` → `{selectedOptionIsCorrect}`) see
`02`/`07`, and `07` turns it into the general leak analysis.

## Threads worth carrying forward

- **Opaque-blob storage + host-owned common functionality** delivers Goal 1 (full integration,
  cross-cutting features for free) and Goal 2 (no coupling).
- **Private-spec-as-master with two derived specs is fundamentally an anti-cheating construct**
  (Goals 6 & 8): the author controls exactly what a browser ever receives, and correctness checks
  stay server-side.
- **Service-info-URL registration** is the seam enabling third-party, self-service plugin addition
  without administrator involvement.
