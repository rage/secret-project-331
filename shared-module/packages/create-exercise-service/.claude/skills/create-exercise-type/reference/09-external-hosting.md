# Hosting a standalone plugin (Track A) on Google Cloud

`04` covers a first-party plugin inside the monorepo (kubernetes/skaffold + a Rust seed row). A
standalone plugin has its own answer: the Terraform repository
`rage/exercise-services-infra`. **Its `README.md` is the procedure** — "Add a plugin", "Give a
plugin a secret", "Move an existing plugin to this hosting", "Remove a plugin" — and this file does
not repeat it. What follows is what you need to route correctly and to build a plugin that fits.

## The shape

- **One Google Cloud project per plugin**, deployed as one **Cloud Run** service. `run.services.create`
  cannot be scoped below a project, so plugins sharing one could delete each other's service and
  take over a hostname; separate projects are the isolation boundary.
- **One shared HTTPS load balancer** in a host project, with a wildcard certificate for
  `*.exercises.mooc.fi`. Each plugin is a host rule pointing at a serverless NEG + backend service in
  that plugin's project, switched on by a `routed` flag in `shared/terraform.tfvars`. Unrouted names
  fall into an "unmatched" sink that answers 404 — the README's `curl .../api/status/up` check is the
  only thing that catches a forgotten flag.
- **The deployment name is not the platform slug.** It is a DNS label of at most 21 characters that
  names the Cloud Run service, the NEG, the backend service, the subdomain and two builder
  identities, and the shared URL map refers to it as a string across state boundaries — expensive to
  change. Pick both names deliberately.
- **Two pipelines that never overlap.** Infrastructure: Cloud Build triggers in the host project
  `plan` every root module on a PR and `apply` the touched ones on merge to `master`; the `shared/`
  apply additionally waits for a human approval. Code: the plugin's own GitHub Actions workflow builds
  the image, pushes it to the plugin project's Artifact Registry and runs
  `gcloud run services update --image`, authenticating by **workload identity federation** — the
  provider accepts an OIDC token only from that repository's `master`, so there is no key to store.
  Terraform ignores the image field, so an infra apply cannot roll a release back (except a
  replacement — rename or region move — which redeploys the placeholder; deploy again after one).
- **The budget is its own root module (`budget/`), applied only from a person's machine.** A budget
  belongs to the billing account, and the narrowest role that can read one grants account-wide
  billing permissions — keeping it out of CI is what lets every builder identity hold no billing
  access at all. It reads the plugin list from `shared/`'s state; re-apply it whenever a plugin is
  added or removed, or the new project's spend goes unwatched.

## What the plugin must provide

- **A `Dockerfile`.** The scaffold ships one (the template's `standalone.Dockerfile`; the monorepo's
  own assume private base images): a build stage that runs `pnpm run build` with `PUBLIC_BASE_PATH`
  and `NEXT_PUBLIC_SERVICE_SLUG` as build args, and a runtime stage with no `node_modules` running
  `node server.mjs` as `node`. Keep its traps intact when you edit it: the runtime stage copies
  `package.json` (for `"type": "module"`), copies with `--chown=node:node` (a umask-077 checkout is
  otherwise unreadable), and lists every module `server.mjs` imports (`dockerfiles.test.ts`
  checks); the pnpm it installs matches `packageManager`'s major. Anything the browser bundle reads
  is inlined at build time, so it is a build arg, never a Cloud Run `env` entry.
- **Listen on `$PORT` (Cloud Run injects `8080`) on `0.0.0.0`**, over plain HTTP/1.1 — the port is
  left unnamed in Terraform because naming it `h2c` turns on end-to-end HTTP/2, which `node:http`
  cannot serve. The template's `server.mjs` already does both; keep them when you edit it.
- **`PUBLIC_BASE_PATH` empty.** The service owns its whole hostname; a base path is only for an
  ingress that mounts it under a prefix. The build arg and the runtime env must agree or every route
  404s.
- **`GET /api/status/up`** answering — it is the README's routing check, not just a k8s probe.
- **Runtime configuration through the module's `env` map**, secrets through `secret_env` (the value
  is added with `gcloud secrets versions add`, never committed; rotation takes effect on the next
  deploy). Two entries fail silently when absent: `ERRORS_BASE_URL` (the crash-report forwarder's
  default is an in-cluster hostname unreachable from Cloud Run) and, for a plugin with a file proxy,
  `ALLOWED_FILE_ORIGINS` (the platform's origin plus the storage host its `GET /api/v0/files/*`
  redirects to; unset means every preview is refused).
- **Drain in-flight requests on `SIGTERM`.** Cloud Run replaces revisions on every deploy, and a
  grade request cut mid-flight fails a student's submission. The template's `graceful-shutdown.mjs`
  does it and exits by 8 s, since Cloud Run sends `SIGKILL` 10 s after `SIGTERM` — so every
  in-request and engine timeout must fit inside that. A service with a backend of its own doesn't
  listen until the backend answers (Cloud Run's default TCP startup probe then waits for it).
- **Rate limits key on the client address** from `X-Forwarded-For`, counted from the end by the
  trusted hops (2 behind the shared load balancer): default to 0 in code, set 2 in the image, and
  keep ingress limited to the load balancer, or the header is forgeable.
- **Cloud Run's `/tmp` is memory**: a disk cache counts against the instance's memory limit, so size
  it inside that, keyed by an immutable host object name.
- **A non-Node backend** (an engine, a PHP or Python service) goes in the same image under a small
  supervisor that exits when any child dies, listens on loopback only, and is never handed a spec
  that would make it fetch a remote resource.

## Registering

Once the hostname answers `/api/service-info` and `/iframe` with the plugin's own body (the
placeholder image answers 200 on every path, so check the JSON, not the status), register it via the
admin API (`04`, "Runtime alternative to seeding") with `public_url` set to the root module's
`service_info_url` output — `https://<name>.exercises.mooc.fi/api/service-info` — and `internal_url`
unset. Moving an already-registered plugin onto this hosting has a cutover trap the README spells out:
for up to sixty seconds the platform requests the old paths against the new origin, and the SPA shell
answers them with 200, so confirm the stored service info shows the new paths before calling it done.

## Known gaps worth knowing before you rely on it

There is no monitoring or alerting — nothing reports a plugin that is down, returning 5xx, or never
routed. Every pull request plans every root module, so build minutes grow with the plugin count. The
load balancer writes no request logs; Cloud Run logs only requests that reach a container.
