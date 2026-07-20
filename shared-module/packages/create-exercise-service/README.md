# @moocfi/create-exercise-service

Scaffolding CLI that creates a new standalone exercise service from the
`services/example-exercise` template.

## Usage

Run it from a checkout of this monorepo:

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

## Notes

- The CLI must run from inside this monorepo. It reads the template and the shared packages
  from the repo on disk, so it is not published as a standalone `pnpm create` package.
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
