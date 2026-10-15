# @moocfi/create-exercise-service

Scaffolding CLI that creates a new standalone exercise service from the
`services/example-exercise` template.

## Usage

From a monorepo checkout, run:

```bash
bin/create-exercise-service
# or
pnpm create-exercise-service
```

It asks for a project name, a target path, the project type, a package manager, and a dev
server port, then creates the project at the path you gave.

After it finishes:

```bash
cd <your-project>
<package-manager> install
<package-manager> run dev
```

## What it generates

A standalone TanStack Start (rsbuild bundler) exercise service, rendered entirely client-side:

- The `example-exercise` template, with the service name, port, locale files, and
  `service-info` display name set to your project.
- A fresh snapshot of the shared exercise packages vendored into `src/shared-module/`
  (`exercise-protocol`, `exercise-client`, `exercise-react`). The generated project tracks
  this snapshot as real source, so it has no dependency on the monorepo at runtime.
- A `package.json` that merges the dependencies the vendored code needs. Monorepo-only bits
  (pinned node version, CSS lint tooling) are dropped.
- Layered browser-test directories: `playwright/plugin-contract/`,
  `playwright/iframe-boundary/`, `playwright/system/`, and `playwright/fixtures/`. The system
  directory is reserved for real-host checks when required. New plugins must not use the legacy
  `e2e/` directory.

When this package is published, its bundled template instead uses the npm strategy: the generated
project depends on the four `@moocfi/exercise-*` packages and does not vendor `src/shared-module/`.
The scaffolder API can supply relative `file:` package specifiers for local package directories or
packed tarballs; absolute `file:` paths are rejected so generated projects remain portable.

## Notes

- From a monorepo checkout, the CLI reads the local template and can vendor local shared packages.
  The published package carries a bundled template and uses published (or explicitly supplied
  relative `file:`) exercise packages instead.
- The vendored `src/shared-module/` is a point-in-time copy. To pull in newer shared code,
  re-run the CLI into a fresh directory or copy the packages over manually.
- Only the React project type is implemented. Svelte and no-framework are placeholders.

## Development

```bash
pnpm test     # structural tests that scaffold into a temp dir and check the output
```

`scripts/scaffold-to.ts` scaffolds without the prompts, which is useful for manual
end-to-end testing:

```bash
pnpm exec tsx scripts/scaffold-to.ts /tmp/my-exercise my-exercise 3002
```
