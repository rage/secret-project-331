# Reference implementation anatomy: `services/example-exercise`

`services/example-exercise` is the canonical, minimal exercise plugin and the template the
scaffolding CLI copies from. It implements a trivial single-choice exercise ("pick the correct
alternative"). Reading it top to bottom is the fastest way to understand the concrete shape of a
plugin. This file walks the whole service, grouped by responsibility.

Stack (from `package.json`): **TanStack Start** on the **rsbuild** bundler, **React 19**,
`react-i18next`, `@emotion` for styling. It runs in **SPA mode** — route components are not
SSR'd, but server routes (the REST endpoints) still run at runtime. Node 24, pnpm.

## 1. The five plugin data types (`src/util/stateInterfaces.ts`)

Every plugin defines its own internal types. For example-exercise:

| Protocol role         | Type in this service  | Shape                                      |
| --------------------- | --------------------- | ------------------------------------------ |
| `private_spec`        | `Alternative[]`       | `{ id, name, correct }` — includes answers |
| `public_spec`         | `PublicAlternative[]` | `{ id, name }` — `correct` stripped        |
| `model_solution_spec` | `ModelSolutionApi`    | `{ correctOptionIds: string[] }`           |
| `answer`              | `Answer`              | `{ selectedOptionId: string }`             |
| `grading_feedback`    | `ExerciseFeedback`    | `{ selectedOptionIsCorrect: boolean }`     |

Key idea: the plugin is free to choose _any_ JSON shape for each of these. The host system treats
them as opaque blobs — it stores them and passes them back, but never inspects their contents. The
only contract the host cares about is the _envelope_ types (below), not the inner spec/answer JSON.

Because the iframe receives its state as untyped `data` over `postMessage`, the file also exports
**defensive parsers** (`parsePublicSpec`, `parsePrivateSpec`, `parseAnswer`, `parseModelSolution`)
and type guards (`isAlternative`, `isPublicAlternative`, `isExerciseFeedback`). These are
deliberately forgiving — a missing/malformed field yields an empty/default value rather than a
crash. A new plugin should follow the same pattern: never trust the incoming blob's shape.

The file also demonstrates the two durability patterns from `reference/07`: **versioning** (a
`SPEC_VERSION` discriminant + `Versioned*` stored shapes + `alternativesFromStored`, which migrates
the legacy bare-`Alternative[]` blob and the versioned envelope on read) and a single
**`validatePrivateSpec(spec) → { valid, errors }`** authority (invariants: ≥1 option, ≥1 correct,
non-empty names; errors are i18n keys) that the editor uses to both set `valid` and render errors.

## 2. The two shared contracts (vendored, do not edit)

The generic host↔plugin contract lives in the vendored shared module and is the same for every
plugin:

- `src/shared-module/exercise-protocol/core/exercise-service-protocol-types.ts` — the
  `postMessage` envelope types: `MessageFromIframe` (`current-state`, `height-changed`,
  `file-upload`, `request-repository-exercises`, `request-iframe-reload`, `open-dialog`) and
  `MessageToIframe` (`set-language`, `set-state`, `upload-result`, `repository-exercises`,
  `test-results`, `dialog-response`). Also `forgivingIsSetStateMessage`.
- `src/shared-module/exercise-protocol/core/exercise-service-protocol-types-2.ts` — the generic
  grading envelope, split out because the type-guard generator chokes on generics:

  ```ts
  export type GradingRequest<S = unknown, D = unknown> = {
    grading_update_url: string
    exercise_spec: S // == private_spec
    submission_data: D // == answer
  }
  export type GradingResult<F = unknown> = {
    grading_progress: "FullyGraded" | "Pending" | "PendingManual" | "Failed"
    score_given: number
    score_maximum: number
    feedback_text: string | null
    feedback_json: F // == grading_feedback (plugin-defined)
    set_user_variables?: { [key: string]: unknown }
  }
  ```

A plugin parameterises these generics with its own types. example-exercise does:

```ts
type ExampleExerciseGradingResult = GradingResult<ExerciseFeedback | null>
type ServiceGradingRequest = GradingRequest<Alternative[], Answer>
```

## 3. Server side — the REST endpoints the backend calls

Business logic lives in `src/server/*.ts` (plain functions returning `Response`), thin TanStack
file-routes in `src/routes/api/*.ts` wire them to HTTP verbs. This split keeps the handlers unit-
testable (see the `*.test.ts` next to each).

### `src/server/serviceInfo.ts` → `GET /api/service-info`

Returns the endpoint map the backend reads to discover every other path. **This is the single
source of truth for the plugin's routes** — the backend follows these paths, so they must be
base-path-prefixed:

```ts
const data: ExerciseServiceInfoApi = {
  service_name: "Example exercise",
  user_interface_iframe_path: `${prefix}/iframe`,
  grade_endpoint_path: `${prefix}/api/grade`,
  public_spec_endpoint_path: `${prefix}/api/public-spec`,
  model_solution_spec_endpoint_path: `${prefix}/api/model-solution`,
  csv_export_definitions_endpoint_path: `${prefix}/api/export-definitions`, // optional
  csv_export_answers_endpoint_path: `${prefix}/api/export-answers`, // optional
}
```

`ExerciseServiceInfoApi` (in `src/util/exerciseServiceApi.ts`) makes the two CSV export paths
optional/nullable — the grade/public-spec/model-solution trio is mandatory.

### `src/server/publicSpec.ts` → `POST /api/public-spec`

Input `SpecRequest` (`{ request_id, private_spec, upload_url }`), output `public_spec`. Derives the
student-visible spec from the private one — here, by dropping the `correct` flag so answers don't
leak to the browser. **This is the security boundary between teacher data and student data.** Both
this endpoint and `modelSolution.ts` run the fail-closed `src/server/leakGuard.ts` (`assertNoLeak`,
which walks the projection for forbidden **keys** and forbidden **values**) before returning, so a
regression that forgets to drop a field throws (500) instead of serving a leak.

### `src/server/modelSolution.ts` → `POST /api/model-solution`

Input `SpecRequest`, output `model_solution_spec`. Here: the list of correct option ids, shown to
students _after_ they answer.

### `src/server/grade.ts` → `POST /api/grade`

Input `GradingRequest<Alternative[], Answer>` (the backend sends `exercise_spec` = the private
spec, and `submission_data` = the student's answer), output `GradingResult`. Returns
`grading_progress`, `score_given`/`score_maximum`, `feedback_text`, and the plugin-defined
`feedback_json`. example-exercise grades synchronously (`grading_progress: "FullyGraded"`).

### Optional CSV export endpoints

`src/server/exportDefinitions.ts` (`/api/export-definitions`) and
`src/server/exportAnswers.ts` (`/api/export-answers`, with `csvExportUtils.ts`) let teachers export
answer data. Optional — but disabling it takes more than omitting the two paths from `service-info`:
the handlers, their `src/routes/api/export-*.ts` routes, and their tests must also be deleted, or
they break `tsc`/`vitest` by importing types you removed. See `05-step-by-step-checklist.md` Step 3
for the full removal list.

### The `jsonRoute` / `readJsonBody` helpers (`src/lib/apiRoutes.ts`)

All POST handlers wrap in `jsonRoute()`, which turns a thrown `BadRequestError` into a `400` and any
other error into a `500`, both as JSON `ClientErrorResponse`. `readJsonBody()` enforces
`Content-Type: application/json` and non-empty valid JSON. Note: TanStack Start doesn't auto-405
undeclared verbs, but the backend only calls the documented verb.

## 4. Client side — the three iframe views

The whole UI is served at one route, `/{base}/iframe`, which switches views based on `set-state`.

### `src/routes/iframe.tsx`

The route: renders `IframeView` wrapped in an error boundary. Client-only.

### `src/components/IframeView.tsx` — the state machine

- Calls `useExerciseServiceParentConnection(onMessage)` to get the `MessagePort`.
- On `set-state`, uses `forgivingIsSetStateMessage`, then branches on `view_type`
  (`answer-exercise` | `exercise-editor` | `view-submission`) and parses the incoming blob into the
  local `State` union with the defensive parsers. Wrapped in `ReactDOM.flushSync` so height is
  reported synchronously.
- On `set-language`, calls `i18n.changeLanguage`.
- Wraps children in `HeightTrackingContainer` (vendored) which auto-sends `height-changed`.

The `State` union it maintains:

```ts
type State =
  | { view_type: "answer-exercise"; public_spec: PublicAlternative[] }
  | {
      view_type: "view-submission"
      public_spec
      answer
      feedback_json
      model_solution_spec
      grading
    }
  | { view_type: "exercise-editor"; private_spec: Alternative[] }
```

### `src/components/Renderer.tsx` — the view dispatcher

Guards on `port`/`state` (shows "waiting" strings), then renders one of the three view components
inside a `<div id={EXERCISE_SERVICE_CONTENT_ID} data-view-type=...>`. Wrapped in
`withErrorBoundary(withNoSsr(...))` — the exercise UI must not SSR.

### The three views

- **`ExerciseEditor.tsx`** (teacher): edits the `private_spec`; on every change posts a
  `current-state` message `{ message: "current-state", data: { private_spec }, valid }` back to the
  parent. The CMS reads this to save.
- **`AnswerExercise.tsx`** (student): renders the `public_spec`; on selection posts `current-state`
  with `{ data: <answer>, valid: true }`. Delegates rendering to `ExerciseBase.tsx`.
- **`ViewSubmission.tsx`** (read-only): renders `public_spec` + `answer` + `model_solution_spec`,
  colouring correct/incorrect. Sends nothing back.

### The connection handshake (vendored — worth understanding)

`useExerciseServiceParentConnection` (in `exercise-react`) is a thin wrapper over
`createParentConnection` (in `exercise-client/client/parentConnection.ts`), which:

1. `parent.postMessage("ready", "*")` on mount, retrying with exponential backoff (cap 10s) until a
   port arrives.
2. Listens for a `message` event from `parent` carrying a `MessagePort` (`event.ports[0]`).
3. Once received, wires `port.onmessage` to the plugin's `onMessage` callback and stops retrying.

A new plugin gets all of this for free by using the hook — it never hand-rolls the handshake.

## 5. Build & serve wiring (the non-obvious, iframe-specific parts)

These files exist because the plugin runs as a **sandboxed, opaque-origin, cross-origin iframe**
mounted under an ingress base path. A new plugin keeps them essentially verbatim, changing only the
name/port.

- **`src/lib/basePath.ts` / `src/router.tsx`**: read `import.meta.env.PUBLIC_BASE_PATH` (e.g.
  `/example-exercise`). rsbuild inlines it at build time so the client router basepath, server
  routes, and asset prefix all agree.
- **`rsbuild.config.ts`**: `tanstackStart({ spa: { enabled: true, maskPath: `${BASE_PATH}/` } })`;
  binds dev server to `0.0.0.0` (so k8s probes/ingress reach it); sets `output.assetPrefix` to the
  base path (the opaque-origin iframe can't resolve relative URLs); stamps `IFRAME_HEADERS` on the
  dev server; inlines `NEXT_PUBLIC_SERVICE_SLUG` for the vendored error reporter; public source maps.
- **`iframe-headers.mjs`**: the CSP/CORS/embedding headers. Permissive CSP
  (`default-src *`) is safe _because the iframe sandbox provides isolation_.
  `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Private-Network: true` because the
  iframe fetches its own API/fonts/assets cross-origin.
- **`server.mjs`**: zero-dependency production Node server (the slim image ships no `node_modules`).
  It (1) serves `dist/client` static assets under the base path, (2) strips the base and forwards
  `/{base}/api/*` and `/{base}/_serverFn/*` to the built TanStack server-entry fetch handler —
  server routes are declared at logical paths (`/api/grade`) and don't inherit the router basepath,
  (3) serves the prerendered SPA shell `_shell.html` for navigations, (4) **re-stamps
  `IFRAME_HEADERS` on every response** including static assets (Start middleware skips static
  responses, which is the whole reason this file exists), (5) binds `0.0.0.0:$PORT`.
- **`Dockerfile`** (dev) and **`Dockerfile.production.slim.dockerfile`** (prod). Dev image just runs
  `pnpm run dev`; prod builds then runs `node server.mjs`.

## 6. The vendored `src/shared-module/`

Four packages are vendored (copied) into `src/shared-module/`:

- `exercise-protocol/` — the framework-agnostic contract (envelope types, guards, constants like
  `EXERCISE_SERVICE_CONTENT_ID`).
- `exercise-client/` — framework-agnostic engines (`parentConnection`, `heightObserver`,
  `outputState`, `parentDialog`, cookie/language utils).
- `exercise-react/` — the React adapter (hooks like `useExerciseServiceParentConnection`,
  `HeightTrackingContainer`, `withNoSsr`, i18n `createI18n`, theme/styles).
- `exercise-service-test-utils/` — the host emulator + Playwright helpers backing the inherited
  `e2e/protocol.spec.ts` suite (see below). Declares no runtime deps of its own.

Consumers import via deep paths `@/shared-module/exercise-react/...`. The upstream source is
`shared-module/packages/*`; a sync mechanism copies it in (see `03-scaffolding-cli.md`). **Treat
`src/shared-module/` as read-only** — edits get overwritten on the next sync.

Every generated project also inherits `playwright.config.ts` and `e2e/protocol.spec.ts`, a working
protocol test built on `exercise-service-test-utils`; keep both when slimming a new plugin down —
they're the regression coverage for the handshake/host-emulator round trip, not template cruft.

## 7. i18n & localisation

`src/i18n/initI18n.ts` + `src/locales/{en,fi}/example-exercise.json`. Namespace/filename match the
service name. The plugin owns its own i18n; the host tells it the language via `set-language`.

## 8. Tests

Every server handler and the key components have colocated `*.test.ts(x)` (Vitest + Testing
Library): `serviceInfo.test.ts`, `publicSpec.test.ts`, `modelSolution.test.ts`, `grade.test.ts`,
`exportAnswers.test.ts`, `exportDefinitions.test.ts`, `status.test.ts`, `IframeView.test.tsx`,
`router.test.ts`, plus the doctrine tests from `reference/07 Part II`: `leakGuard.test.ts` (leak
regression), `roundTrip.test.ts` (an answer built only from the public spec grades against the
private spec), `stateInterfaces.test.ts` (validity), and
`src/util/migration/migrateToLatest.test.ts` (the migration suite anchored at v1: a legacy
no-version blob lifts to latest, a v1 blob passes through unchanged, an unknown/future version fails
loud, with frozen per-version fixtures). A new plugin should keep this pattern — the endpoint tests
double as a spec of the request/response envelopes.

## What a new plugin must change vs. keep

**Change (the exercise-specific ~20%):**

- `src/util/stateInterfaces.ts` — your five (versioned) data types + guards/validity.
- `src/util/migration/{versions,migrateToLatest}.ts` — **keep the chain structure, retype it**: one
  version source + per-kind step registries (empty at v1) + `migrate*ToLatest` per stored type, with
  the forgiving `parse*` wrappers for the iframe. Every door routes through it; adding v2 later must
  stay a one-line registry addition per kind.
- `src/server/{publicSpec,modelSolution,grade}.ts` — your spec-derivation and grading logic. Keep the
  checker (normalization/acceptance) under `src/server/`, **never** in a view-imported util: public
  source maps ship, so grading code reachable from a view module can leak the algorithm to students
  (L8). Adapt — or delete — the CSV `export{Definitions,Answers}.ts` handlers to match your data.
- `src/components/{ExerciseEditor,AnswerExercise,ViewSubmission}.tsx` — your three views. The a11y and
  validity patterns here (accessible names not raw ids, feedback conveyed by more than colour, a
  single `validate()` authority that both sets `valid` **and** renders errors) apply to input-based
  exercises too — carry them over.
- `src/components/{IframeView,Renderer}.tsx` — **keep the skeleton**, but retype the `State` union /
  view props to your types (and thread `previous_submission` if you support retry-prefill). Not
  verbatim — see below.
- Delete the multiple-choice-only helpers you don't reuse (`ExerciseBase.tsx`, `ButtonEditor.tsx`), or
  `tsc` fails on their imports of removed types.
- `src/styles/theme.ts` — extend with any tokens your views need (the shipped palette is minimal).
- `serviceInfo.ts` `service_name`, locale files, port, package name.

**Keep verbatim (the plugin plumbing ~80%):** the protocol envelope usage, the `IframeView`
state-machine **wiring** and `Renderer` dispatcher wiring (handshake, `flushSync`, error boundary — you
retype only their `State`/props, per the change list above), `apiRoutes.ts` helpers, all of
`src/shared-module/`, `rsbuild.config.ts`, `server.mjs`, `iframe-headers.mjs`, `router.tsx`,
`basePath.ts`, Dockerfiles.

This ~80/20 split is exactly why the scaffolding CLI exists — see `03-scaffolding-cli.md`.
