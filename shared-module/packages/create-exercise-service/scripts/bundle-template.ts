// Build step for the published @moocfi/create-exercise-service package.
//
// The CLI scaffolds from services/example-exercise. When published to npm it cannot read the
// monorepo, so this script snapshots the template (with the same exclusions the CLI's copyTemplate
// applies, and without the git-ignored vendored src/shared-module) into dist/template. At runtime
// the published CLI detects that bundled directory and switches to npm mode. Run after tsdown, via
// the package's `build` script.

import { rm } from "node:fs/promises"
import { join, resolve } from "node:path"

import { copyTemplate } from "../src/index.ts"

const packageDir = resolve(import.meta.dirname, "..")
// scripts -> create-exercise-service -> packages -> shared-module -> repository root
const repoRoot = resolve(packageDir, "../../..")
const templateSrc = join(repoRoot, "services", "example-exercise")
const templateDest = join(packageDir, "dist", "template")

await rm(templateDest, { recursive: true, force: true })
await copyTemplate(templateSrc, templateDest)
console.log(`Bundled template snapshot -> ${templateDest}`)
