import { existsSync } from "node:fs"
import { cp, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, extname, join, relative, resolve, sep } from "node:path"

const SCRIPT_DIR = import.meta.dirname
// src -> create-exercise-service -> packages -> shared-module -> repository root
const REPO_ROOT = resolve(SCRIPT_DIR, "../../../..")
const MONOREPO_TEMPLATE_DIR = join(REPO_ROOT, "services", "example-exercise")
const SHARED_PACKAGES_DIR = join(REPO_ROOT, "shared-module", "packages")

// The published package ships a snapshot of the template next to the built CLI (dist/template),
// produced by scripts/bundle-template.ts. Its presence is how we tell "running from npm" (standalone
// mode) apart from "running inside the monorepo" (dev mode).
const BUNDLED_TEMPLATE_DIR = join(SCRIPT_DIR, "template")

/**
 * How the generated project gets the shared exercise code:
 * - "vendor": copy each package's `src` into `src/shared-module/` (monorepo dev; lets you scaffold
 *   against local, unpublished shared-module changes).
 * - "npm": depend on the published `@moocfi/exercise-*` packages and rewrite the template's
 *   `@/shared-module/exercise-*` imports to them (what a standalone `pnpm create` produces).
 */
export type SharedModuleStrategy = "vendor" | "npm"

/** The @moocfi/exercise-* packages a standalone (npm-mode) project depends on. */
const NPM_RUNTIME_PACKAGES = [
  "@moocfi/exercise-protocol",
  "@moocfi/exercise-client",
  "@moocfi/exercise-react",
]
const NPM_DEV_PACKAGES = ["@moocfi/exercise-service-test-utils"]

/** The literal service name used throughout the example-exercise template. */
const TEMPLATE_SERVICE_NAME = "example-exercise"

/**
 * Shared-module packages vendored into the generated project's `src/shared-module/`, mirroring
 * `shared-module/sync.ts` so the template's `@/shared-module/<pkg>/...` imports resolve. The
 * exercise-service code is a layered set — exercise-protocol ← exercise-client ← exercise-react
 * (the iframe child's React adapter); the template imports nothing from common/components or the
 * host-side exercise-iframe-host. exercise-service-test-utils is vendored for the inherited e2e
 * suite (`e2e/protocol.spec.ts`); it declares no runtime deps, so it adds nothing to the generated
 * package.json (its `@playwright/test` comes from the template's devDependencies).
 */
const VENDORED_PACKAGES = [
  "exercise-protocol",
  "exercise-client",
  "exercise-react",
  "exercise-service-test-utils",
]

/** Top-level entries in the template that must never be copied into a generated project. */
export const COPY_EXCLUDES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".tanstack",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.tsbuildinfo",
  ".vscode",
  // Playwright outputs from running the template's e2e suite; git-ignored, but the copier doesn't
  // read .gitignore, so exclude them explicitly (they also hold binaries that name replacement would
  // corrupt).
  "test-results",
  "playwright-report",
  "blob-report",
  ".playwright-cli",
  // moocfi-internal deployment files (private GCR base images + pnpm workspace); broken in a
  // standalone project, so not generated.
  "Dockerfile",
  "Dockerfile.production.slim.dockerfile",
  ".dockerignore",
])

const STANDALONE_EDITORCONFIG = `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
`

// pnpm skips a dep's build script unless allow-listed. esbuild (via vitest) is the only
// build-scripted dep in the standalone tree, and the monorepo's pnpm-workspace.yaml isn't copied,
// so write a minimal one.
const STANDALONE_PNPM_WORKSPACE = `allowBuilds:
  esbuild: true
`

interface PackageJson {
  name?: string
  version?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

async function isNonEmptyDir(path: string): Promise<boolean> {
  try {
    const entries = await readdir(path)
    return entries.length > 0
  } catch {
    return false
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T
}

/** Apply a set of literal string replacements to a file in place. */
async function replaceInFile(path: string, replacements: [string, string][]): Promise<void> {
  let contents = await readFile(path, "utf8")
  for (const [from, to] of replacements) {
    contents = contents.split(from).join(to)
  }
  await writeFile(path, contents)
}

/**
 * Copy the template tree, skipping COPY_EXCLUDES entries and the synced shared-module (re-vendored
 * fresh).
 */
export async function copyTemplate(src: string, dest: string): Promise<void> {
  const sharedModuleDir = join(src, "src", "shared-module")
  await cp(src, dest, {
    recursive: true,
    dereference: false,
    filter: (source: string) => {
      if (source === src) {
        return true
      }
      const rel = relative(src, source)
      const topLevel = rel.split(sep)[0] ?? ""
      if (COPY_EXCLUDES.has(topLevel)) {
        return false
      }
      // The synced shared-module copy is git-ignored and excluded from tsc; we vendor a fresh one.
      if (source === sharedModuleDir || source.startsWith(sharedModuleDir + sep)) {
        return false
      }
      return true
    },
  })
}

/** Vendor a snapshot of each shared package's `src` into `<project>/src/shared-module/<pkg>`. */
async function vendorSharedModules(projectPath: string): Promise<void> {
  for (const pkg of VENDORED_PACKAGES) {
    const from = join(SHARED_PACKAGES_DIR, pkg, "src")
    const to = join(projectPath, "src", "shared-module", pkg)
    await mkdir(dirname(to), { recursive: true })
    await cp(from, to, { recursive: true, dereference: true })
  }
}

/**
 * Rewrite the template's internal shared-module alias to the published npm package names. The
 * template imports siblings as `@/shared-module/exercise-<pkg>/...`; standalone projects get that
 * code from npm, so those become `@moocfi/exercise-<pkg>/...` (the published packages expose the
 * same deep paths). This is the npm-mode counterpart to vendorSharedModules.
 */
async function rewriteSharedModuleImportsToNpm(projectPath: string): Promise<void> {
  await replaceNameInAllFiles(projectPath, [["@/shared-module/exercise-", "@moocfi/exercise-"]])
}

/** Auto-detect the strategy from whether the CLI is running from the published package. */
function resolveSharedModuleStrategy(): SharedModuleStrategy {
  return existsSync(BUNDLED_TEMPLATE_DIR) ? "npm" : "vendor"
}

/** This CLI's own version, used to pin the generated project's `@moocfi/exercise-*` deps. */
async function readCliVersion(): Promise<string> {
  const pkg = await readJson<PackageJson>(join(SCRIPT_DIR, "..", "package.json"))
  return pkg.version ?? "0.0.0"
}

/**
 * Build the generated package.json.
 *
 * - "vendor": the vendored shared code needs deps the lean template doesn't declare, so merge in the
 *   shared packages' dep sets (the template's own pins win on conflict).
 * - "npm": add the published `@moocfi/exercise-*` packages (pinned to this CLI's version). Their own
 *   deps (emotion, immer, fontsource, ...) come transitively from npm, so nothing else is merged.
 */
async function buildPackageJson(
  projectPath: string,
  projectName: string,
  port: number,
  strategy: SharedModuleStrategy,
  exercisePackagesVersion: string,
): Promise<void> {
  const pkg = await readJson<PackageJson>(join(projectPath, "package.json"))

  const merged: Record<string, string> = {}
  if (strategy === "vendor") {
    // Start from the shared packages, then let the template override.
    for (const sharedPkg of VENDORED_PACKAGES) {
      const shared = await readJson<PackageJson>(
        join(SHARED_PACKAGES_DIR, sharedPkg, "package.json"),
      )
      Object.assign(merged, shared.dependencies, shared.peerDependencies)
    }
  }
  Object.assign(merged, pkg.dependencies)
  if (strategy === "npm") {
    for (const npmPkg of NPM_RUNTIME_PACKAGES) {
      merged[npmPkg] = `^${exercisePackagesVersion}`
    }
    pkg.devDependencies = { ...pkg.devDependencies }
    for (const npmPkg of NPM_DEV_PACKAGES) {
      pkg.devDependencies[npmPkg] = `^${exercisePackagesVersion}`
    }
  }

  pkg.name = projectName
  pkg.version = "0.1.0"
  pkg.dependencies = Object.fromEntries(
    Object.entries(merged).toSorted(([a], [b]) => a.localeCompare(b)),
  )
  // The template pins an exact node version for the monorepo; a standalone project shouldn't carry
  // it.
  delete pkg.devEngines

  // Stylelint + postcss-styled-syntax exist only for the monorepo's root CSS lint job; a standalone
  // project has no stylelint config or lint:css script, so drop them.
  for (const lintOnlyDevDep of [
    "stylelint",
    "stylelint-config-recommended",
    "postcss-styled-syntax",
  ]) {
    delete pkg.devDependencies?.[lintOnlyDevDep]
  }

  if (pkg.scripts?.dev) {
    pkg.scripts.dev = pkg.scripts.dev.replace(/--port\s+\d+/, `--port ${port}`)
  }

  // A standalone project has no monorepo-wide `bin/tsc-check-all`, so give it a one-command type
  // check. The template already ships `typescript` and a `tsconfig.json` with `noEmit`.
  if (pkg.scripts) {
    pkg.scripts.typecheck = "tsc --noEmit"
  }

  await writeFile(join(projectPath, "package.json"), JSON.stringify(pkg, null, 2) + "\n")
}

/** Rename the template's locale namespace files to match the new service name. */
async function renameLocales(projectPath: string, projectName: string): Promise<void> {
  for (const lang of ["en", "fi"]) {
    const dir = join(projectPath, "src", "locales", lang)
    await rename(
      join(dir, `${TEMPLATE_SERVICE_NAME}.json`),
      join(dir, `${projectName}.json`),
    ).catch(() => {
      /* locale may not exist for every language; ignore */
    })
  }
}

/** Binary file extensions that must not be read/written as UTF-8 during name replacement. */
const BINARY_EXTENSIONS = new Set([
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".avif",
  ".pdf",
  // Playwright trace/video artifacts, in case any escape COPY_EXCLUDES.
  ".zip",
  ".webm",
])

/**
 * Apply literal replacements to every text file in the generated project, skipping the vendored
 * shared-module, VCS/build/dependency dirs and binary assets. A whole-tree sweep (not a fixed file
 * list) keeps the generator correct as the template evolves.
 */
async function replaceNameInAllFiles(
  root: string,
  replacements: [string, string][],
  dir: string = root,
): Promise<void> {
  const sharedModuleDir = join(root, "src", "shared-module")
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (
        ["node_modules", ".git", "dist", ".turbo"].includes(entry.name) ||
        full === sharedModuleDir
      ) {
        continue
      }
      await replaceNameInAllFiles(root, replacements, full)
    } else if (entry.isFile() && !BINARY_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      await replaceInFile(full, replacements)
    }
  }
}

/** Replace the service name and other template-specific values throughout the generated project. */
async function parameterize(projectPath: string, projectName: string): Promise<void> {
  // Display name (e.g. "my-exercise" -> "My exercise") for service_name and the document <title>.
  const displayName = projectName.replaceAll(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase())

  // Display literal first, then the slug: they don't overlap ("Example exercise" vs
  // "example-exercise"), so one pass covers every occurrence.
  await replaceNameInAllFiles(projectPath, [
    ["Example exercise", displayName],
    [TEMPLATE_SERVICE_NAME, projectName],
  ])

  await renameLocales(projectPath, projectName)

  // Standalone .editorconfig (the template's delegates to the monorepo root).
  await writeFile(join(projectPath, ".editorconfig"), STANDALONE_EDITORCONFIG)

  // Standalone pnpm-workspace.yaml (the template's is excluded from the copy). pnpm skips a dep's
  // build script unless allow-listed, so this lets `pnpm install` build esbuild. Always emitted:
  // npm and yarn ignore the file, and this repo is a pnpm shop, so a `pnpm install` in a project
  // scaffolded with npm/yarn still works instead of failing on esbuild's skipped build script.
  await writeFile(join(projectPath, "pnpm-workspace.yaml"), STANDALONE_PNPM_WORKSPACE)

  // Track the vendored shared-module snapshot instead of ignoring it (it is real source now).
  const gitignorePath = join(projectPath, ".gitignore")
  let gitignore = await readFile(gitignorePath, "utf8")
  gitignore = gitignore
    .replace(/^# Shared module that has been copied to this project\n/m, "")
    .replace(/^shared-module\n?/m, "")
  await writeFile(gitignorePath, gitignore)
}

export type PackageManager = "npm" | "yarn" | "pnpm"

export interface ScaffoldOptions {
  projectName: string
  /** Absolute path the project will be created at. */
  absoluteProjectPath: string
  port: number
  /** Package manager the generated project targets; used only for the printed "next steps". */
  packageManager?: PackageManager
  /**
   * How to supply the shared exercise code. Defaults to auto-detect: "npm" when running from the
   * published package, "vendor" when running inside the monorepo.
   */
  sharedModule?: SharedModuleStrategy
  /** Override the template directory (defaults to the bundled snapshot or the monorepo template). */
  templateDir?: string
  /** Version to pin the generated `@moocfi/exercise-*` deps to (npm mode). Defaults to the CLI's. */
  exercisePackagesVersion?: string
}

/** Create a standalone React exercise service from the example-exercise template. */
export async function scaffoldReactProject(options: ScaffoldOptions): Promise<void> {
  const { projectName, absoluteProjectPath, port } = options
  const strategy = options.sharedModule ?? resolveSharedModuleStrategy()
  const templateDir =
    options.templateDir ?? (strategy === "npm" ? BUNDLED_TEMPLATE_DIR : MONOREPO_TEMPLATE_DIR)
  const exercisePackagesVersion = options.exercisePackagesVersion ?? (await readCliVersion())

  if (await isNonEmptyDir(absoluteProjectPath)) {
    throw new Error(
      `Target directory ${absoluteProjectPath} already exists and is not empty. Aborting.`,
    )
  }

  console.log("Copying template...")
  await copyTemplate(templateDir, absoluteProjectPath)

  if (strategy === "vendor") {
    console.log("Vendoring shared modules...")
    await vendorSharedModules(absoluteProjectPath)
  } else {
    console.log("Wiring up @moocfi/exercise-* packages...")
    await rewriteSharedModuleImportsToNpm(absoluteProjectPath)
  }

  // Parameterize before generating package.json: parameterize() runs a blind whole-tree slug sweep
  // (TEMPLATE_SERVICE_NAME -> projectName). If it ran after buildPackageJson set `name` to a
  // projectName that itself contains the template slug (e.g. "my-example-exercise"), the sweep would
  // rewrite the slug again and yield "my-my-example-exercise". Running buildPackageJson last makes
  // its explicit `name`/`version`/deps the authoritative final write, immune to the sweep.
  console.log("Parameterizing project...")
  await parameterize(absoluteProjectPath, projectName)

  console.log("Generating package.json...")
  await buildPackageJson(absoluteProjectPath, projectName, port, strategy, exercisePackagesVersion)
}

async function main() {
  const { confirm, input, select } = await import("@inquirer/prompts")

  const projectName = await input({
    message: "Project name",
    validate: (value) => value.length > 0,
  })
  const projectPath = await input({
    message: "Path to the project",
    validate: (value) => value.length > 0,
    default: `${projectName}`,
  })
  const projectType = await select({
    message: "Project type",
    choices: [
      {
        name: "React",
        value: "react",
        description:
          "An exercise service built with React using TanStack Start (rsbuild bundler), rendered entirely client-side, using TypeScript.",
      },
      {
        name: "Svelte",
        disabled: "Not implemented yet",
        value: "svelte",
        description: "Svelte with SvelteKit, using typescript",
      },
      {
        name: "No framework (not recommended)",
        disabled: "Not implemented yet",
        value: "no-framework",
        description:
          "No framework, just plain HTML, CSS and JS. This is a simplistic example that demonstrates that the exercise services are not tied to any frontend frameworks. Please choose some framework if you want to build something that is both usable and maintainable.",
      },
    ],
  })
  const packageManager: PackageManager = await select({
    message: "Package manager",
    // pnpm is the repo's package manager and the only one that needs the generated
    // pnpm-workspace.yaml, so it's the default.
    default: "pnpm",
    choices: [
      { name: "pnpm", value: "pnpm" },
      { name: "npm", value: "npm" },
      { name: "yarn", value: "yarn" },
    ],
  })
  const port = await input({
    message: "Development server port",
    default: "3002",
    validate: (value) =>
      (/^\d+$/.test(value) && Number(value) > 0 && Number(value) < 65536) ||
      "Enter a valid port number",
  })
  // convert projectPath to an absolute path
  const absoluteProjectPath = resolve(projectPath)
  const confirmation = await confirm({
    message: `The project will be created in ${absoluteProjectPath}. Continue?`,
    default: false,
  })
  if (!confirmation) {
    console.log("Aborting")
    return
  }

  if (projectType !== "react") {
    console.error(`Project type "${projectType}" is not implemented yet.`)
    process.exitCode = 1
    return
  }

  try {
    await scaffoldReactProject({
      projectName,
      absoluteProjectPath,
      port: Number(port),
      packageManager,
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
    return
  }

  const sharedModuleNote =
    resolveSharedModuleStrategy() === "npm"
      ? `Note: the exercise SDK comes from the @moocfi/exercise-* npm packages (see package.json).`
      : `Note: src/shared-module/ is a vendored snapshot of the @moocfi shared code. Re-run
create-exercise-service (or copy the packages over manually) to update it.`

  console.log(`
Done! Created exercise service "${projectName}" in ${absoluteProjectPath}

Next steps:
  cd ${projectPath}
  ${packageManager} install
  ${packageManager} run dev    # → http://localhost:${port}

${sharedModuleNote}
`)
}

// Only run the interactive CLI when executed directly, not when imported (e.g. by tests).
if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  try {
    await main()
  } catch (error) {
    // @inquirer/prompts rejects with ExitPromptError when the user aborts a prompt with Ctrl+C;
    // exit quietly instead of printing an unhandled-rejection stack trace.
    if (error instanceof Error && error.name === "ExitPromptError") {
      process.exitCode = 130
    } else {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    }
  }
}
