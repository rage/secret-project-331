# Backend & infra integration (headless-lms + kubernetes/skaffold)

The scaffolding CLI produces a runnable plugin but does **not** wire it into the LMS. This file
documents everything the Rust backend (`services/headless-lms`) and the infra need in order to
discover, deploy, and route to a new exercise service. Good news: **the backend is fully generic** —
no new Rust types or migrations are needed per exercise type. You add a **seed row + infra
manifests**, and the plugin's own `service-info` response does the rest.

## The data model (already exists — do not add migrations)

Two tables, created in `migrations/20210611045905_add_exercise_services.up.sql` and reshaped by later
migrations:

**`exercise_services`** — one row per plugin _type_:

| column                                                  | notes                                                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id` UUID PK                                            |                                                                                                                              |
| `created_at` / `updated_at` / `deleted_at`              | soft-delete                                                                                                                  |
| `name` VARCHAR NOT NULL                                 | human name, e.g. "Quizzes"                                                                                                   |
| `slug` VARCHAR NOT NULL **UNIQUE**                      | e.g. `quizzes`; **must equal `exercise_tasks.exercise_type`** — this coupling is how grading/spec-gen routes to your service |
| `public_url` NOT NULL                                   | full URL of the **service-info endpoint**, internet-reachable                                                                |
| `internal_url` nullable                                 | full URL of service-info, in-cluster; falls back to `public_url`                                                             |
| `max_reprocessing_submissions_at_once` INTEGER NOT NULL | regrader batch size                                                                                                          |

**`exercise_service_info`** — the discovered endpoint paths. **Not seeded** — populated at runtime by
a background fetcher (see discovery below). Columns: `user_interface_iframe_path`,
`grade_endpoint_path`, `public_spec_endpoint_path`, `model_solution_spec_endpoint_path`,
`has_custom_view` (bool), and nullable `csv_export_definitions_endpoint_path` /
`csv_export_answers_endpoint_path`.

## Endpoint discovery (why you only seed a URL)

`public_url` / `internal_url` store the URL of the **service-info endpoint itself** (e.g.
`.../example-exercise/api/service-info`). The backend never hard-codes the other endpoints:

1. Background worker `server/src/programs/service_info_fetcher.rs` loops every 60s, GETting each
   service's service-info URL (prefers `internal_url`, 10 concurrent).
2. `exercise_service_info.rs::fetch_and_upsert_service_info` parses the returned
   `ExerciseServiceInfoApi` and upserts the **relative paths** into `exercise_service_info`.
3. When the backend needs to call an endpoint, it takes the stored base URL, **strips the path**, and
   appends the discovered relative path (`get_internal_grade_url` / `get_internal_public_spec_url` /
   `get_model_solution_url` in `exercise_services.rs:176-204`). The comment there explains: "all
   relative urls in service info assume that the base url prefix has no path."
4. On-demand fallback if the worker hasn't populated it yet:
   `get_upsert_service_info_by_exercise_service`.

So the single source of truth for your plugin's routes is the `service-info` JSON your plugin
returns — see `02-reference-implementation-anatomy.md` §3.

## The seed entry (the one thing you must add in Rust)

`server/src/programs/seed/seed_exercise_services.rs` (invoked from `seed/mod.rs`). Copy an existing
block:

```rust
exercise_services::ExerciseServiceNewOrUpdate {
    name: "Example Exercise".to_string(),
    slug: "example-exercise".to_string(),
    public_url: "http://project-331.local/example-exercise/api/service-info".to_string(),
    internal_url: Some(
        "http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info".to_string()
    ),
    max_reprocessing_submissions_at_once: 5,
}
// quizzes -> port 3004, base path /quizzes
// tmc     -> port 3005, base path /tmc
```

URL conventions for a new slug on port `<port>`:

- `internal_url`: `http://<slug>.default.svc.cluster.local:<port>/<base-path>/api/service-info`
- `public_url`: `http://project-331.local/<base-path>/api/service-info`

`insert_exercise_service` is at `models/src/exercise_services.rs:252-278`. Only `exercise_services`
is seeded; `exercise_service_info` fills in automatically.

**Runtime alternative to seeding:** admin API `POST /api/v0/main-frontend/exercise-services`
(`server/src/controllers/main_frontend/exercise_services.rs:70-85`) registers a service and
immediately fetches its service-info. Useful for external/self-service plugins that aren't part of
the seed.

## The generic Rust plumbing (already handles your service — FYI, no changes)

All outbound HTTP to plugins lives in `server/src/domain/models_requests.rs`:

- **public-spec / model-solution**: `SpecRequest { request_id, private_spec, upload_url }` POSTed by
  `make_spec_fetcher`, attaching an `exercise-service-upload-claim` JWT (lets the plugin upload
  files). Returns arbitrary `serde_json::Value`.
- **service-info fetch**: `fetch_service_info` / `_fast` (120s vs 5s timeouts).
- **grading**: `make_grading_request_sender` POSTs `ExerciseTaskGradingRequest`
  (`{ grading_update_url, exercise_spec (=private_spec), submission_data (=answer) }`, from
  `models/src/exercise_task_gradings.rs`) with an `exercise-service-grading-update-claim` JWT, and
  receives `ExerciseTaskGradingResult`.
- **CSV export**: `post_exercise_service_csv_export_request` (optional endpoints).
- All JWT claims are HS256-signed with the shared `jwt_password`; header-name constants are noted as
  "keep in sync with the shared-module constants."

Triggers: spec generation fires on CMS page save (`models/src/pages.rs::upsert_exercise_tasks`,
building per-`exercise_type` public-spec + model-solution URLs and calling the fetcher). Grading
fires from `server/src/domain/exercises.rs` and the `regrader`. The `SpecFetcher` trait alias is in
`models/src/lib.rs:293-310`.

The point: **as long as `exercise_tasks.exercise_type == exercise_services.slug`, spec generation and
grading route to your plugin automatically.** No per-type Rust code.

## Infra manifests to add

Using a new port (existing: example-exercise 3002, quizzes 3004, tmc 3005):

1. **`kubernetes/base/<slug>/deployment.yml`** (new) — model on
   `kubernetes/base/example-exercise/deployment.yml`: a headless `Service` (`clusterIP: None`,
   `port: <port>`) + `Deployment` with `containerPort: <port>`, env `PUBLIC_BASE_PATH=/<base-path>`,
   and startup/liveness/readiness probes on `/<base-path>/api/status/up`.
2. **`kubernetes/base/kustomization.yaml`** — add `- <slug>/deployment.yml` to `resources`.
3. **`kubernetes/base/ingress.yml`** — add a `path: /<base-path>` rule → `service: <slug>, port:
<port>` (example-exercise at `:34-40`).
4. **`kubernetes/production/kustomization.yaml`** — add an `images:` entry (`name: <slug>` →
   `newName: eu.gcr.io/moocfi-public/secret-project-<slug>-production-slim:latest`) and a `replicas:`
   entry.
5. **`skaffold.yaml`** — add a build artifact (`- image: <slug>`, `context: services/<slug>`, sync
   `src/**/*`, `dockerfile: Dockerfile`).
6. **`skaffold.production.yaml`** — add the production image artifact.
7. **`Tiltfile`** — add the slug to `NODE_SERVICES` and `WEB_WORKLOADS`, and a build tuple to the
   production-build list.

The plugin therefore needs a **`/<base-path>/api/status/up` health endpoint** (example-exercise has
`src/routes/api/status/up.ts`) for the k8s probes.

> `tmc` has RBAC extras (service accounts, user-sync manifests) — those are TMC-specific and **not**
> required for a generic new service.

## Backend + infra checklist (condensed)

1. Plugin exposes `GET /<base-path>/api/service-info` (+ the referenced grade / public-spec /
   model-solution [+ optional csv] endpoints, the iframe UI, and `/<base-path>/api/status/up`).
2. Add an `ExerciseServiceNewOrUpdate` entry in `seed_exercise_services.rs`. **No new migration.**
3. (or) register at runtime via `POST /api/v0/main-frontend/exercise-services`.
4. Add k8s Deployment+Service, register in `kubernetes/base/kustomization.yaml`, add ingress path,
   add prod image+replicas.
5. Add skaffold (dev + prod) + Tiltfile entries.
6. Bring up the env (`bin/dev`) and re-seed (`bin/seed`) so the row is inserted. The `service_info_
fetcher` discovers the endpoints within ~60s; verify the `exercise_service_info` row appears.

**Key files:** `models/src/exercise_services.rs`, `models/src/exercise_service_info.rs`,
`models/src/exercise_task_gradings.rs`, `models/src/lib.rs` (SpecFetcher),
`server/src/domain/models_requests.rs`, `server/src/programs/service_info_fetcher.rs`,
`server/src/programs/seed/seed_exercise_services.rs`, plus the migrations / k8s / skaffold / Tiltfile
above.
