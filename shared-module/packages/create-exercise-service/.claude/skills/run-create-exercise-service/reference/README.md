# Creating new exercise-service plugin types — analysis

Analysis of how to add a new exercise type to this LMS (`secret-project-331`, UH MOOC platform) as
an IFrame-based **exercise service plugin**. Synthesized from `docs/plugin-system.md`, the reference
implementation `services/example-exercise`, the scaffolding CLI, the `headless-lms` backend, the
kubernetes/skaffold/Tilt infra, and the master's thesis behind the design (see
`06-design-rationale-thesis.md`).

This reference ships inside the `run-create-exercise-service` skill (see `../SKILL.md`); read it
alongside the shipped protocol doc `docs/plugin-system.md`.

## The one-paragraph answer

An exercise type is an **independent web app** ("exercise service" / plugin) on its own server. It
integrates with the host by embedding three **sandboxed-IFrame views** (editor, answer,
view-submission) that talk to the host UI over the **Channel Messaging API**, and by exposing five
**REST endpoints** (service-info, public-spec, model-solution, grade, iframe) that the backend calls
server-to-server. The plugin defines five **JSON data types** (private_spec, public_spec,
model_solution_spec, answer, grading_feedback) that the host stores and passes around as **opaque
blobs**. Building one = **define 5 data types, implement 5 endpoints, implement 3 views** — the
scaffolding CLI (`bin/create-exercise-service`) generates ~80% of it from `example-exercise`, and the
backend needs **no per-type Rust code**, only one seed row plus infra manifests.

## Read in this order

| File                                                                                 | What it covers                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[01-protocol-and-architecture.md](01-protocol-and-architecture.md)**               | The contract: data types, IFrame messaging protocol, the 3 views, the REST endpoints, lifecycles. Start here.                                                                                                                                  |
| **[02-reference-implementation-anatomy.md](02-reference-implementation-anatomy.md)** | `services/example-exercise` file-by-file: what to change vs. keep. The concrete template.                                                                                                                                                      |
| **[03-scaffolding-cli.md](03-scaffolding-cli.md)**                                   | `bin/create-exercise-service` — prompts, what it generates, and the shared-module vendoring/sync mechanism.                                                                                                                                    |
| **[04-backend-and-infra-integration.md](04-backend-and-infra-integration.md)**       | `headless-lms` seed + generic protocol plumbing + endpoint discovery, and the kubernetes/skaffold/Tilt manifests.                                                                                                                              |
| **[05-step-by-step-checklist.md](05-step-by-step-checklist.md)**                     | The actionable end-to-end sequence (Track A standalone vs. Track B first-party).                                                                                                                                                               |
| **[06-design-rationale-thesis.md](06-design-rationale-thesis.md)**                   | The "why", from the thesis: needs, goals, isolation model, and why the design is shaped this way.                                                                                                                                              |
| **[07-key-design-decisions.md](07-key-design-decisions.md)**                         | The decisions that matter when designing a plugin: data modelling (versioning, derivation, leaks, ids, answers, validity) and how to test the data models/forms. **This is the source of the SKILL's mandatory data-model confirmation step.** |

## Key facts worth internalizing

- **The host is a generic container.** It treats all plugin specs/answers/feedback as opaque JSON.
  This is what lets teams add types without touching the core (thesis Need 1, Goals 1 & 2).
- **`slug` == `exercise_tasks.exercise_type`** is the routing key. Get it right and grading +
  spec-generation route to your service automatically.
- **`service-info` is the discovery + registration seam.** The backend is seeded only with that
  endpoint's URL; a 60s background worker learns every other path from its response. No hard-coded
  endpoints, no per-type migrations.
- **public_spec / model_solution_spec are derived from private_spec** specifically to control what a
  student's browser ever receives — an anti-cheating construct (thesis Goals 6 & 8). Grading is
  always server-to-server; the private spec never reaches the consumer.
- **~80% of a plugin is reusable plumbing** — the handshake, height reporting, error boundaries,
  i18n, and the IFrame-specific build/serve wiring (`rsbuild.config.ts`, `server.mjs`,
  `iframe-headers.mjs`) all come from the template + vendored `shared-module`. You write the
  exercise-specific ~20%.
- **The Playground** (courses.mooc.fi/playground-tabs) is the dev harness — point it at your
  service-info URL to exercise all views + spec generation + grading without the full LMS.

## Stack note

The reference service (and the scaffolder output) is **TanStack Start on the rsbuild bundler**,
React 19, SPA mode. Server routes (`src/routes/api/*.ts`) run at runtime; view components are
client-only. A zero-dependency `server.mjs` serves it in production and re-stamps the iframe headers
on every response.
