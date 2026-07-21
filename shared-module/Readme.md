# Shared module

This project consists of multiple programs that sometimes need to share code. The shared code is placed in shared module. Also, some programs are not a part of this repository, but they still need access to some parts of the shared module. Due to different programs needing access to slightly different kinds of code, the shared module has been split into multiple packages. The packages needed by external programs are published to NPM.

The programs in the repository will use direct copies of the packages instead of the NPM packages. This is done to make it easier to develop the shared module and the programs at the same time. This is accomplished with a program that synchronizes hard links of the shared modules into the programs `src` directory. This approach works well with our build and bundling process.

To ensure that the syncing is up-to-date, you can use the following command on the root of the repository:

```bash
bin/shared-module-sync-watch
```

See `sync.ts` for implementation details.

## Publishing to npm

External exercise plugins cannot use the sync mechanism, so the exercise-service packages are also
published to npm under the `@moocfi` scope:

- `@moocfi/exercise-protocol`
- `@moocfi/exercise-client`
- `@moocfi/exercise-react`
- `@moocfi/exercise-iframe-host`
- `@moocfi/exercise-service-test-utils`

The repo's own services never consume these from npm. Publishing and internal vendoring are fully
decoupled: services import the shared code through `@/shared-module/...` tsconfig path aliases that
resolve to the synced `src/`, which ignores `package.json` `main`/`exports`. So the published
metadata (pointing at `dist/`) has no effect on internal builds.

### How the build works

Each package builds with [tsdown](https://tsdown.dev) (`pnpm build`), configured in its
`tsdown.config.ts`:

- Output is ESM only, one `.mjs` + `.d.mts` per source file (`unbundle` mode), preserving the `src/`
  tree. A wildcard `"./*"` exports map means external consumers import the same deep paths the
  internal code uses, for example `@moocfi/exercise-react/react/hooks/useFileUpload`.
- Sibling packages imported in source as `@/shared-module/exercise-*/...` are rewritten to bare
  `@moocfi/exercise-*/...` and marked external, so each package depends on its siblings via npm
  rather than inlining their source.
- `publint` and `@arethetypeswrong/cli` run as part of every build.
- The packages ship ESM via the `.mjs` extension and deliberately omit a `type` field so the repo's
  CommonJS jest configs keep working unchanged.

`exercise-react` and `exercise-iframe-host` use a build-only `tsconfig.build.json` that switches JSX
to the React automatic runtime (the dev tsconfig keeps `jsx: preserve` for the services' Next.js
build). `exercise-service-test-utils` copies its `src/browser/hostEmulator.js` into `dist` verbatim.

### Releasing

Releases are lockstep (all packages share one version) and triggered by pushing a git tag named
`exercise-packages-vX.Y.Z`. The `.github/workflows/publish-exercise-packages.yml` workflow builds
each package, stamps the version and injects the inter-package `@moocfi/*` dependencies with
`scripts/prepare-npm-release.ts`, and publishes to npm using
[trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers/) with provenance. There is no
`NPM_TOKEN`.

The committed `package.json` files intentionally do not list their `@moocfi/*` siblings as
dependencies (they would be unresolvable before first publish and break `pnpm install`); the release
script is the source of truth for those, injecting them just before publish.

First-time setup, per package (trusted publishing cannot do a package's first publish):

1. Publish the initial version manually (`pnpm build && pnpm publish` with `npm login` + 2FA or a
   short-lived granular token) after running `scripts/prepare-npm-release.ts <version>`.
2. On npmjs.com, add a trusted publisher for the package: repo `rage/secret-project-331`, workflow
   `publish-exercise-packages.yml`, environment `npm-publish` (all case-sensitive).
3. Set the package to require 2FA and disallow tokens (trusted publishers keep working).

Provenance attestations require the source repo to be public.
