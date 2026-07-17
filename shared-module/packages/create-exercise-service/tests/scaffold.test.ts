import assert from "node:assert/strict"
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, describe, test } from "node:test"

import { scaffoldReactProject } from "../src/index.ts"

const PROJECT_NAME = "smoke-exercise"
const PORT = 4567

/** Relative paths inside the generated project that should never contain the template name. */
const SKIP_DIRS = new Set(["shared-module", "node_modules", ".git", "dist"])

/** Recursively collect files whose contents still mention the template service name. */
async function findStrayTemplateName(root: string, dir = root): Promise<string[]> {
  const stray: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue
    }
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      stray.push(...(await findStrayTemplateName(root, full)))
    } else if (entry.isFile()) {
      const contents = await readFile(full, "utf8")
      if (contents.includes("example-exercise")) {
        stray.push(full.slice(root.length + 1))
      }
    }
  }
  return stray
}

/** Recursively collect source files (outside SKIP_DIRS) whose contents match a pattern. */
async function findFilesMatching(root: string, pattern: RegExp, dir = root): Promise<string[]> {
  const matches: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue
    }
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      matches.push(...(await findFilesMatching(root, pattern, full)))
    } else if (
      entry.isFile() &&
      /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) &&
      pattern.test(await readFile(full, "utf8"))
    ) {
      matches.push(full.slice(root.length + 1))
    }
  }
  return matches
}

describe("scaffoldReactProject", () => {
  let base: string
  let projectPath: string

  before(async () => {
    base = await mkdtemp(join(tmpdir(), "ces-test-"))
    projectPath = join(base, PROJECT_NAME)
    await scaffoldReactProject({
      projectName: PROJECT_NAME,
      absoluteProjectPath: projectPath,
      port: PORT,
    })
  })

  after(async () => {
    await rm(base, { recursive: true, force: true })
  })

  test("creates the expected files and vendored packages", async () => {
    for (const rel of [
      "package.json",
      "tsconfig.json",
      "src/shared-module/exercise-protocol",
      "src/shared-module/exercise-client",
      "src/shared-module/exercise-react",
    ]) {
      await assert.doesNotReject(stat(join(projectPath, rel)), `${rel} should exist`)
    }
  })

  test("parameterizes package.json (name, version, port, merged deps)", async () => {
    const pkg = JSON.parse(await readFile(join(projectPath, "package.json"), "utf8"))
    assert.equal(pkg.name, PROJECT_NAME)
    assert.equal(pkg.version, "0.1.0")
    assert.match(pkg.scripts.dev, new RegExp(`--port ${PORT}\\b`))
    // Dependencies pulled in from the vendored shared packages.
    assert.ok(pkg.dependencies.immer, "immer should be merged in from exercise-client")
    assert.ok(pkg.dependencies["@emotion/react"], "emotion should be merged in from exercise-react")
    // Monorepo-only constraint dropped.
    assert.equal(pkg.devEngines, undefined)
  })

  test("allow-lists the build scripts pnpm needs", async () => {
    const workspace = await readFile(join(projectPath, "pnpm-workspace.yaml"), "utf8")
    assert.match(workspace, /allowBuilds:/)
    assert.match(workspace, /esbuild: true/)
  })

  test("generates the TanStack Start stack, not Next.js", async () => {
    const pkg = JSON.parse(await readFile(join(projectPath, "package.json"), "utf8"))
    assert.ok(pkg.dependencies["@tanstack/react-start"], "@tanstack/react-start should be a dep")
    assert.ok(pkg.dependencies["@tanstack/react-router"], "@tanstack/react-router should be a dep")
    assert.equal(pkg.dependencies.next, undefined, "next should not be a dep")
    for (const rel of [
      "rsbuild.config.ts",
      "server.mjs",
      "vitest.config.ts",
      "iframe-headers.mjs",
      "src/routeTree.gen.ts",
    ]) {
      await assert.doesNotReject(stat(join(projectPath, rel)), `${rel} should exist`)
    }
  })

  test("omits monorepo-only files", async () => {
    for (const rel of [
      "Dockerfile",
      "Dockerfile.production.slim.dockerfile",
      ".dockerignore",
      "pnpm-lock.yaml",
    ]) {
      await assert.rejects(stat(join(projectPath, rel)), `${rel} should not be generated`)
    }
  })

  test("replaces the template service name", async () => {
    const wrapper = await readFile(
      join(projectPath, "src/components/layout/ClientLayoutWrapper.tsx"),
      "utf8",
    )
    assert.match(wrapper, new RegExp(`const SERVICE_NAME = "${PROJECT_NAME}"`))
    const serviceInfo = await readFile(join(projectPath, "src/server/serviceInfo.ts"), "utf8")
    assert.match(serviceInfo, /service_name: "Smoke exercise"/)
  })

  test("renames locale namespace files", async () => {
    await assert.doesNotReject(stat(join(projectPath, `src/locales/en/${PROJECT_NAME}.json`)))
    await assert.doesNotReject(stat(join(projectPath, `src/locales/fi/${PROJECT_NAME}.json`)))
  })

  test("stops ignoring the vendored shared-module in .gitignore", async () => {
    const gitignore = await readFile(join(projectPath, ".gitignore"), "utf8")
    assert.doesNotMatch(gitignore, /^shared-module$/m)
  })

  test("leaves no stray template name outside src/shared-module", async () => {
    const stray = await findStrayTemplateName(projectPath)
    assert.deepEqual(stray, [], `template name still present in: ${stray.join(", ")}`)
  })

  test("the generated app code imports no next/* modules", async () => {
    // SKIP_DIRS excludes the vendored shared-module, so this checks only the project's own code.
    const offenders = await findFilesMatching(projectPath, /from ["']next\/|require\(["']next\//)
    assert.deepEqual(offenders, [], `next imports still present in: ${offenders.join(", ")}`)
  })
})
