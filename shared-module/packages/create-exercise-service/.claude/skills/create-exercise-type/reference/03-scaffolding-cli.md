# Scaffolding a new service: `bin/create-exercise-service` + shared-module vendoring

The scaffolding CLI generates a **standalone** TanStack Start (rsbuild) React exercise service from
the `services/example-exercise` template, with the shared exercise packages vendored in as real
source. **The CLI produces a runnable project; it does NOT wire the plugin into the running LMS** —
that second tier is manual (see `04-backend-and-infra-integration.md` and the checklist).

## Running it

```bash
bin/create-exercise-service     # or: pnpm create-exercise-service
```

`bin/create-exercise-service` is a thin bash launcher that `cd`s into
`shared-module/packages/create-exercise-service` and runs `pnpm start` (= `tsx src/index.ts`). The
package is `@moocfi/create-exercise-service`; its only runtime dep is `@inquirer/prompts`. **It must
run from inside this monorepo** — it reads the template and shared packages from disk and is not
published as a standalone `pnpm create` package.

## Prompts (in order)

1. **Project name** — non-empty. Becomes the package name and the base for the display name.
2. **Path to the project** — default is the project name. ⚠️ Resolved relative to the CLI package's
   own directory (the launcher `cd`s there first), so the default lands _inside_
   `shared-module/packages/create-exercise-service/<name>`, **not** under `services/`. For real LMS
   integration, pass an explicit path like `services/<slug>` (see the standalone-vs-in-monorepo
   decision below).
3. **Project type** — `React` (only one implemented). `Svelte` and `No framework` are shown as
   disabled placeholders in the picker and cannot be selected (arrow-key navigation skips them).
4. **Package manager** — npm / yarn / pnpm. Only used for the printed next-steps text.
5. **Dev server port** — default `3002`, validated 1–65535. ⚠️ `3002` collides with example-exercise;
   pick a free one (quizzes uses 3004, tmc 3005).
6. **Confirmation** — "The project will be created in `<abs path>`. Continue?" (default no).

## What it generates (the pipeline)

`scaffoldReactProject()` in `src/index.ts` aborts if the target dir exists and is non-empty, then:

1. **`copyTemplate`** — recursively copies `services/example-exercise`, skipping `node_modules`,
   `dist`/`build`/`coverage`/`.turbo`/`.tanstack`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
   `tsconfig.tsbuildinfo`, `.vscode`, the template's own Playwright output dirs (`test-results`,
   `playwright-report`, `blob-report`, `.playwright-cli` — git-ignored but not `.gitignore`-aware
   copying, so excluded explicitly), the moocfi-internal deploy files (`Dockerfile`,
   `Dockerfile.production.slim.dockerfile`, `.dockerignore`), and the template's own
   `src/shared-module/` (re-vendored next).
2. **`vendorSharedModules`** — copies a fresh snapshot of four shared packages (see below).
3. **`buildPackageJson`** — rewrites `package.json`: merges the vendored packages' deps +
   peerDeps (template deps win on conflict, sorted); sets `name`/`version` (`0.1.0`); drops
   `devEngines` (monorepo node pin) and the lint-only devDeps (`stylelint`,
   `stylelint-config-recommended`, `postcss-styled-syntax`); rewrites the dev script port.
4. **`parameterize`** — the renaming sweep:
   - Display name derived from slug: `my-exercise` → `My exercise`.
   - Whole-tree text sweep (`replaceNameInAllFiles`) applying two literal replacements to every text
     file (skipping `node_modules`/`.git`/`dist`/`.turbo`/vendored `src/shared-module/` and binary
     extensions): `"Example exercise" → <displayName>`, then `"example-exercise" → <projectName>`.
     This updates e.g. `serviceInfo.ts`'s `service_name` and `ClientLayoutWrapper.tsx`'s
     `SERVICE_NAME`. It's a sweep, not a fixed file list, so it stays correct as the template evolves.
   - `renameLocales`: `src/locales/{en,fi}/example-exercise.json` → `<projectName>.json`.
   - Writes a standalone `.editorconfig` and a minimal `pnpm-workspace.yaml`
     (`allowBuilds: esbuild: true`).
   - Edits `.gitignore` to _remove_ the `shared-module` ignore line — in the generated project the
     vendored copy is tracked real source, not synced-in ignored files.

Result: a standalone client-rendered React exercise service with **no runtime dependency on the
monorepo**, at the path you gave. The CLI prints the `cd / install / run dev` next steps and a note
that `src/shared-module/` is a point-in-time snapshot.

## The two `src/shared-module/` mechanisms (don't conflate them)

The directory name is shared by two different mechanisms:

### Live sync (in-monorepo services) — `shared-module/sync.ts`

For services that live _inside_ the monorepo (`services/example-exercise`, `quizzes`, `tmc`, …),
`shared-module/sync.ts` watches `shared-module/packages/*/src` (`@parcel/watcher`) and `rsync`s each
package into every consuming service's `src/shared-module/<pkg>` per its `SYNC_TARGETS` table. Run
via `pnpm --dir shared-module run sync` / `sync-once`, or the wrappers `bin/shared-module-sync-watch`
and `bin/copy-and-check-shared-module`. For `example-exercise` it syncs `exercise-protocol`,
`exercise-client`, `exercise-react`, and `exercise-service-test-utils` (explicitly excluding
`common`/`components` because example-exercise is the standalone-capable template; test-utils is
synced only into example-exercise — see `TEST_UTIL_TARGETS` in `sync.ts`). This is why the
in-monorepo services' `src/shared-module/` is git-ignored and always regenerated.

### Point-in-time vendor (generated standalone project) — `vendorSharedModules`

The CLI mirrors that logic but copies **once**. Driven by
`VENDORED_PACKAGES = ["exercise-protocol", "exercise-client", "exercise-react",
"exercise-service-test-utils"]`, it `cp`s each package's `src` into `<project>/src/shared-module/<pkg>`.
Layering: protocol ← client ← react (the iframe-child React adapter); test-utils backs the inherited
`e2e/protocol.spec.ts` suite and declares no runtime deps. Host-side `exercise-iframe-host` and
`common`/`components` are intentionally not vendored (the template imports nothing from them). The
generated project tracks this snapshot as real source; **there is no sync script in a generated
standalone project** — to update it, re-run the CLI into a fresh dir or copy the packages over
manually (all four, or the inherited e2e suite silently drifts out of date).

## Decision: standalone vs. in-monorepo

The key branch a new-plugin author faces:

- **External / standalone plugin** (like the two GitHub examples `language-exercise-service`,
  `factor-analysis-exercise-service`): scaffold anywhere, keep the vendored snapshot, deploy on your
  own infra, register with the host by URL. No monorepo coupling.
- **First-party plugin shipped with the LMS**: scaffold **into `services/<slug>`** (the skaffold
  build `context`), keep `src/shared-module/` updated via `bin/shared-module-sync-watch`, and do the
  Tier-B backend + infra wiring in `04-backend-and-infra-integration.md`.

## CLI development helpers

```bash
pnpm test                                              # structural scaffold-to-temp tests
pnpm exec tsx scripts/scaffold-to.ts /tmp/x my-exercise 3002   # non-interactive scaffold
```

(The author-facing caveats — React-only, port `3002` collides, the default path resolves relative to
the CLI dir, and the vendored snapshot doesn't auto-update — are flagged inline in "Prompts" and the
two `src/shared-module/` sections above, rather than repeated here.)
