# Step-by-step: creating a new exercise service, end to end

The actionable sequence, tying together the protocol (`01`), the reference impl (`02`), the
scaffolder (`03`), and backend/infra (`04`). Two tracks depending on where the plugin will live.

## Decide the track first — with the user, not by default

- **Track A — external / standalone plugin** (own repo, own infra; like `rage/language-exercise-
service`). Only steps 1–4 + step 9 (register by URL). No monorepo/skaffold/k8s work. The scaffold
output is genuinely standalone (fresh install, tsc, tests, and boot all work outside any workspace
or git repo), so "own repo" is a first-class target — scaffold straight to the external path.
- **Track B — first-party plugin shipped inside this monorepo** (`services/<slug>`; like
  `example-exercise`, `quizzes`, `tmc`). All steps — including the silently-missable ones (5–8): a
  service scaffolded into `services/` without them rots quietly.

The placement is the user's call — **ask it explicitly** (it is not implied by the slug/port
question), and confirm which of the chosen track's obligations are in scope for the session.

> Before any step below: SKILL.md's Part A design gates — scope/features, the five data types, and
> the three views, each explicitly confirmed by the user — must be passed first. This file picks up
> after that sign-off.

## Pick identity

- **Slug** (kebab-case, unique), e.g. `my-exercise`. This becomes the `exercise_services.slug` and
  **must equal** the `exercise_tasks.exercise_type` the CMS assigns — it's the routing key.
- **Base path** = `/<slug>` (ingress mount point).
- **Port** — free one. Taken: 3002 (example-exercise), 3004 (quizzes), 3005 (tmc). Do **not** reuse
  the CLI default 3002.
- **Display name** — "My exercise".

## Step 1 — Scaffold

Interactively:

```bash
bin/create-exercise-service
```

or non-interactively (agents, CI — same `scaffoldReactProject()`, explicit absolute path, no TTY):

```bash
pnpm --dir shared-module/packages/create-exercise-service exec tsx scripts/scaffold-to.ts <abs-path> <slug> <port>
```

Answer/pass: project name = slug; **path = `services/<slug>` for Track B, your external repo path
for Track A** (the CLI default lands in the wrong place — see `03`); type = React; port = your free
port. Then:

```bash
cd services/<slug>   # (or your standalone path)
pnpm install
pnpm run dev         # http://localhost:<port>
```

(See `03-scaffolding-cli.md` for exactly what gets generated/renamed.)

## Step 2 — Define your 5 data types

Edit `src/util/stateInterfaces.ts`: replace `Alternative`/`PublicAlternative`/`Answer`/
`ModelSolutionApi`/`ExerciseFeedback` with your `private_spec` / `public_spec` / `model_solution_spec`
/ `answer` / `grading_feedback` shapes, and rewrite the defensive parsers/guards (keep them
forgiving — the iframe receives untyped `postMessage` data). Parameterize the grading generics in
your grade handler: `GradingRequest<YourPrivateSpec, YourAnswer>`, `GradingResult<YourFeedback>`.

Adapt the template's **migration chain** to your types rather than replacing it with inline version
checks: the per-type version registry + `migrate*ToLatest` functions the template ships are what
every stored-blob door must route through, and adding v2 later must stay a one-line registry
addition (see `07` §1). Version gates apply to **every** stored type — including the answer: a
parser that stamps the current version without reading the incoming one silently relabels future
blobs instead of migrating them.

## Step 3 — Implement the 3 server transforms

- `src/server/publicSpec.ts` — derive `public_spec` from `private_spec`, **dropping anything that
  would leak answers**. This is the security boundary. Keep the template's `assertNoLeak` **call**
  in the handler (adapted to your forbidden keys/values) — a leak guard that exists but is no longer
  invoked by the endpoint protects nothing, and add a test that the endpoint output itself carries
  only the allowlisted keys.
- `src/server/modelSolution.ts` — derive `model_solution_spec` from `private_spec` (same
  `assertNoLeak` rule). If your exercise type genuinely has no model solution, return `null` —
  keep the endpoint (the service-info contract needs it) and confirm the "nothing to show peer
  reviewers" choice with the user.
- `src/server/grade.ts` — grade `submission_data` against `exercise_spec` (the private spec); return
  `grading_progress` + `score_given`/`score_maximum` + `feedback_text` + `feedback_json`. Grade
  **server-side only** — never trust the client.
- (optional) `src/server/exportDefinitions.ts` / `exportAnswers.ts` for CSV export. `csvExportUtils.ts`
  is generic (pass your own item guard to `parseSpecArrayStrict`), but the two handlers still carry
  the template's multiple-choice columns/logic — rewrite them for your data. To **disable** CSV export
  it is not enough to omit the paths from `service-info`: also delete `exportDefinitions.ts` /
  `exportAnswers.ts`, their two `src/routes/api/export-*.ts` routes, and their `*.test.ts` files, or
  they'll fail `tsc`/`vitest` by importing types you removed.

## Step 4 — Implement the 3 views

- `src/components/ExerciseEditor.tsx` — teacher UI editing the private spec; post `current-state`
  `{ data: { private_spec }, valid }` on every change.
- `src/components/AnswerExercise.tsx` — student UI over the public spec; post `current-state`
  `{ data: answer, valid }` on interaction. If it seeds state from `previous_submission`, also emit
  a `current-state` for the seeded answer — otherwise the host's `valid` gate stays unset and a
  student cannot resubmit unchanged prior work.
- `src/components/ViewSubmission.tsx` — read-only render of public_spec + answer +
  model_solution_spec + grading_feedback.
- Keep `IframeView.tsx`'s state-machine skeleton and `Renderer.tsx`'s dispatcher; just update the
  parsing/props to your types. Update `serviceInfo.ts` `service_name`, the locale files (they live
  at `src/locales/<lang>/<slug>.json` — per-language dirs, file named after the slug; keep en/fi key
  sets identical), and the page title.

Verify against the **Playground** (courses.mooc.fi/playground-tabs): point it at your
`http://localhost:<port>/<base-path>/api/service-info` and exercise all views + spec generation +
grading. Run `pnpm test` (the endpoint tests double as an envelope spec).

## Step 5 (Track B) — Keep the vendored shared-module synced

In-monorepo services regenerate `src/shared-module/` from `shared-module/packages/*`. `shared-module/
sync.ts`'s `SYNC_TARGETS` is keyed by _package_, each listing its destination services — add your
service's `src/shared-module` path to `REACT_EXERCISE_TARGETS` (covers `exercise-protocol`,
`exercise-client`, `exercise-react`, mirroring what `example-exercise` receives). If you keep the
scaffold's inherited e2e suite (`e2e/protocol.spec.ts`, the default), also add it to
`TEST_UTIL_TARGETS` for `exercise-service-test-utils` — that list currently contains only
`example-exercise`, so a new Track B service is not synced by default and its vendored copy would go
stale. Then run `bin/shared-module-sync-watch` while developing. Treat `src/shared-module/` as
read-only. (Standalone Track A keeps its point-in-time vendored snapshot.)

## Step 6 (Track B) — Register in the backend seed

`services/headless-lms/server/src/programs/seed/seed_exercise_services.rs`: add an
`ExerciseServiceNewOrUpdate { name, slug, public_url, internal_url,
max_reprocessing_submissions_at_once }`:

- `public_url`: `http://project-331.local/<base-path>/api/service-info`
- `internal_url`: `Some("http://<slug>.default.svc.cluster.local:<port>/<base-path>/api/service-info")`

**No new migration needed** — the generic `exercise_services` / `exercise_service_info` schema
already supports arbitrary services.

## Step 7 (Track B) — Infra manifests

- The scaffolder deliberately excludes `Dockerfile`, `Dockerfile.production.slim.dockerfile`, and
  `.dockerignore` (moocfi-internal deploy files, broken in a standalone project — see `03`). Copy
  these three from `services/example-exercise/` into `services/<slug>/` before wiring skaffold below,
  or the build will fail with "Dockerfile not found."
- `kubernetes/base/<slug>/deployment.yml` (headless Service + Deployment; env
  `PUBLIC_BASE_PATH=/<base-path>`; probes on `/<base-path>/api/status/up`) — model on
  `kubernetes/base/example-exercise/deployment.yml`.
- Register in `kubernetes/base/kustomization.yaml`; add ingress path in `kubernetes/base/ingress.yml`;
  add prod `images` + `replicas` in `kubernetes/production/kustomization.yaml`.
- `skaffold.yaml` + `skaffold.production.yaml` build artifacts (`image: <slug>`, `context:
services/<slug>`).
- `Tiltfile`: add slug to `NODE_SERVICES` and `WEB_WORKLOADS` (+ production-build tuple).

Ensure the plugin has `src/routes/api/status/up.ts` (the template does) for the k8s probes.

## Step 8 (Track B) — Bring up & seed

```bash
bin/dev            # skaffold builds your image and deploys it
bin/seed           # inserts the exercise_services row
```

The `service_info_fetcher` worker discovers your endpoints within ~60s and populates
`exercise_service_info`. Verify the row exists and that the CMS lists your exercise type.

## Step 9 (Track A) — Register a standalone plugin by URL

Deploy the plugin on your own infra so its service-info URL is reachable, then register it via the
admin API `POST /api/v0/main-frontend/exercise-services` (name/slug/public_url/internal_url), which
immediately fetches its service-info. No monorepo changes.

## Definition of done

- [ ] All 3 views render correctly in the Playground for representative specs.
- [ ] public-spec leaks nothing that enables cheating; model-solution is appropriately narrower than
      the private spec — and a test proves the **endpoints'** output carries only allowlisted keys
      (the guard being unit-tested is not enough if no handler calls it).
- [ ] grade returns correct scores server-side; `valid` flag set correctly in `current-state`.
- [ ] All stored-blob doors route through the shared `migrate*ToLatest` chain; migration test suite
      exists and is anchored at v1 (see `07` Part II #3).
- [ ] `set-language` respected (BCP 47, English fallback); height reported correctly.
- [ ] `pnpm test` green; endpoint tests cover the request/response envelopes.
- [ ] The e2e protocol suite (`e2e/protocol.spec.ts`) is **comprehensive**, not a smoke test: every
      editor control + `valid` transitions, the answer flow's happy path and every client-side
      rejection the design defines, `previous_submission` seeding, view-submission incl. degenerate
      cases, and an old-version spec emitting the migrated version. This bar is unconditional — test
      *strategy* may be discussed with the user, test thoroughness is not.
- [ ] (Track B) `shared-module/sync.ts` targets updated (step 5) — including `TEST_UTIL_TARGETS` if
      the e2e suite is kept; seed row present; `exercise_service_info` populated; CMS can add the
      exercise; answering + grading + view-submission work end to end in a seeded course.

## The 80/20 to remember

You change ~20% (the 5 data types, 3 server transforms, 3 views, name/port/locales) and keep ~80%
verbatim (the protocol plumbing, build/serve wiring, all of `src/shared-module/`). The backend needs
**zero** per-type Rust code beyond one seed row. The full file-by-file change-vs-keep list lives in
`02-reference-implementation-anatomy.md` — don't re-derive it.
