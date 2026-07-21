// Stamps the release version onto the publishable @moocfi/exercise-* packages and injects the real
// inter-package dependencies just before publishing to npm.
//
// Why this exists: the packages are isolated pnpm projects (no shared workspace, no `workspace:`
// protocol), and their inter-package edges live only as tsconfig path aliases
// (`@/shared-module/exercise-*`), which the tsdown build rewrites to bare `@moocfi/*` externals.
// The committed package.json files therefore do NOT list their `@moocfi/*` siblings as
// dependencies — if they did, `pnpm install` would try to resolve unpublished packages from the
// registry and fail. This script is the authoritative source for both the version and the sibling
// dependency ranges, run in CI (and for the manual bootstrap) right before `pnpm publish`.
//
// Ordering in the release workflow:
//   1. pnpm install --frozen-lockfile        (matches committed package.json: no sibling deps)
//   2. tsx scripts/prepare-npm-release.ts X   (this script: set version + inject sibling deps)
//   3. pnpm build                             (externalizes siblings; does not need them installed)
//   4. pnpm publish --no-git-checks           (publishes the stamped package.json)
//
// Usage: tsx shared-module/scripts/prepare-npm-release.ts <version>   e.g. 1.4.0
// The version must be a bare semver (no leading "v" / tag prefix).

import { readFile, writeFile } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const PACKAGES_DIR = path.resolve(import.meta.dirname, "../packages")

// Publishable packages and their @moocfi/* sibling dependencies. Keep this graph in sync with the
// `@/shared-module/exercise-*` imports in each package's src (and with sync.ts's target matrix).
const SIBLING_DEPENDENCIES: Record<string, string[]> = {
  "exercise-protocol": [],
  "exercise-client": ["@moocfi/exercise-protocol"],
  "exercise-react": ["@moocfi/exercise-client", "@moocfi/exercise-protocol"],
  "exercise-iframe-host": ["@moocfi/exercise-protocol"],
  "exercise-service-test-utils": ["@moocfi/exercise-protocol"],
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

async function main(): Promise<void> {
  const version = process.argv[2]
  if (!version || !SEMVER.test(version)) {
    console.error(`Expected a bare semver version argument, got: ${JSON.stringify(version)}`)
    console.error("Usage: tsx shared-module/scripts/prepare-npm-release.ts <version>")
    process.exit(1)
  }

  // All published packages release together at the same version; a caret range lets consumers dedupe
  // patch/minor releases of the set while staying within the lockstep major.
  const siblingRange = `^${version}`

  for (const [pkg, siblings] of Object.entries(SIBLING_DEPENDENCIES)) {
    const manifestPath = path.join(PACKAGES_DIR, pkg, "package.json")
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"))

    manifest.version = version

    if (siblings.length > 0) {
      const dependencies = { ...manifest.dependencies }
      for (const sibling of siblings) {
        dependencies[sibling] = siblingRange
      }
      manifest.dependencies = sortKeys(dependencies)
    }

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n")
    const injected = siblings.length > 0 ? ` (deps: ${siblings.join(", ")} @ ${siblingRange})` : ""
    console.log(`@moocfi/${pkg} -> ${version}${injected}`)
  }
}

function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).toSorted(([a], [b]) => a.localeCompare(b)))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
