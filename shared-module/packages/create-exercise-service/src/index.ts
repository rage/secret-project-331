import { cp, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
// src -> create-exercise-service -> packages -> shared-module -> repository root
const REPO_ROOT = resolve(SCRIPT_DIR, "../../../..")
const TEMPLATE_DIR = join(REPO_ROOT, "services", "example-exercise")
const SHARED_PACKAGES_DIR = join(REPO_ROOT, "shared-module", "packages")

/** The literal service name used throughout the example-exercise template. */
const TEMPLATE_SERVICE_NAME = "example-exercise"

/**
 * Shared-module packages vendored into the generated project's `src/shared-module/`. The layout
 * mirrors `shared-module/sync.ts` so the template's `@/shared-module/<pkg>/...` imports resolve.
 * `exercise-plugins` re-exports from `@/shared-module/common/...`, so `common` is required too.
 * `components` is intentionally omitted: the template imports nothing from it.
 */
const VENDORED_PACKAGES = ["common", "exercise-plugins"]

/** Top-level entries in the template that must never be copied into a generated project. */
const COPY_EXCLUDES = new Set([
  "node_modules",
  ".next",
  "out",
  "build",
  "coverage",
  ".turbo",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.tsbuildinfo",
  ".vscode",
  // moocfi-internal deployment files (reference private GCR base images + pnpm workspace); useless
  // and broken in a standalone project, so they are not generated.
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
async function replaceInFile(path: string, replacements: Array<[string, string]>): Promise<void> {
  let contents = await readFile(path, "utf8")
  for (const [from, to] of replacements) {
    contents = contents.split(from).join(to)
  }
  await writeFile(path, contents)
}

/**
 * Copy the template directory tree, skipping excluded top-level entries, the synced shared-module
 * directory (re-vendored fresh), and any symlinks (e.g. the monorepo `.vscode` link).
 */
async function copyTemplate(src: string, dest: string): Promise<void> {
  const sharedModuleDir = join(src, "src", "shared-module")
  await cp(src, dest, {
    recursive: true,
    dereference: false,
    filter: (source: string) => {
      if (source === src) {
        return true
      }
      const rel = relative(src, source)
      const topLevel = rel.split(sep)[0]
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
 * Build the generated package.json. The vendored shared code pulls in dependencies the lean
 * template does not declare itself, so we merge the shared packages' dependency sets in. The
 * template's own pins win on conflict (they are the proven, lean versions).
 */
async function buildPackageJson(
  projectPath: string,
  projectName: string,
  port: number,
): Promise<void> {
  const pkg = await readJson<PackageJson>(join(projectPath, "package.json"))

  const merged: Record<string, string> = {}
  // Start from the shared packages, then let the template override.
  for (const sharedPkg of VENDORED_PACKAGES) {
    const shared = await readJson<PackageJson>(join(SHARED_PACKAGES_DIR, sharedPkg, "package.json"))
    Object.assign(merged, shared.dependencies, shared.peerDependencies)
  }
  Object.assign(merged, pkg.dependencies)

  pkg.name = projectName
  pkg.version = "0.1.0"
  pkg.dependencies = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)))
  // The template pins an exact node version for the monorepo's controlled environment; a generated
  // standalone project should not carry that constraint.
  delete pkg.devEngines

  if (pkg.scripts?.dev) {
    pkg.scripts.dev = pkg.scripts.dev.replace(/--port\s+\d+/, `--port ${port}`)
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

/** Replace the service name and other template-specific values throughout the generated project. */
async function parameterize(
  projectPath: string,
  projectName: string,
): Promise<void> {
  const nameReplacement: Array<[string, string]> = [[TEMPLATE_SERVICE_NAME, projectName]]

  // SERVICE_NAME constants.
  for (const file of [
    "src/app/layout.tsx",
    "src/components/layout/ClientLayoutWrapper.tsx",
    "src/lib/apiRoutes.ts",
  ]) {
    await replaceInFile(join(projectPath, file), [
      [`const SERVICE_NAME = "${TEMPLATE_SERVICE_NAME}"`, `const SERVICE_NAME = "${projectName}"`],
    ])
  }

  // i18next type augmentation: import path, defaultNS and the resources key all use the namespace.
  await replaceInFile(join(projectPath, "types/i18next.d.ts"), nameReplacement)

  // Human-readable display name reported by the service-info endpoint (e.g. "my-exercise" -> "My
  // exercise"). Derived from the project name; the author can refine it afterwards.
  const displayName = projectName
    .replace(/[-_]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
  await replaceInFile(join(projectPath, "src/app/api/service-info/route.ts"), [
    [`service_name: "Example exercise"`, `service_name: "${displayName}"`],
  ])

  await renameLocales(projectPath, projectName)

  // Standalone .editorconfig (the template's delegates to the monorepo root).
  await writeFile(join(projectPath, ".editorconfig"), STANDALONE_EDITORCONFIG)

  // The vendored shared code pulls in the full `common` dependency set, some of which still declare
  // legacy React peer ranges. The monorepo tolerates this via pnpm; npm needs legacy-peer-deps. The
  // key is a no-op for pnpm/yarn, which handle peers themselves.
  await writeFile(join(projectPath, ".npmrc"), "legacy-peer-deps=true\n")

  // Track the vendored shared-module snapshot instead of ignoring it (it is real source now).
  const gitignorePath = join(projectPath, ".gitignore")
  let gitignore = await readFile(gitignorePath, "utf8")
  gitignore = gitignore
    .replace(/^# Shared module that has been copied to this project\n/m, "")
    .replace(/^shared-module\n?/m, "")
  await writeFile(gitignorePath, gitignore)

  // Drop the monorepo-relative typeRoot; keep the local one + node_modules.
  await replaceInFile(join(projectPath, "tsconfig.json"), [
    [`"typeRoots": ["types", "./shared-module/types", "./node_modules/@types"]`, `"typeRoots": ["types", "./node_modules/@types"]`],
  ])
}

export interface ScaffoldOptions {
  projectName: string
  /** Absolute path the project will be created at. */
  absoluteProjectPath: string
  port: number
}

/** Create a standalone React exercise service from the example-exercise template. */
export async function scaffoldReactProject(options: ScaffoldOptions): Promise<void> {
  const { projectName, absoluteProjectPath, port } = options

  if (await isNonEmptyDir(absoluteProjectPath)) {
    throw new Error(
      `Target directory ${absoluteProjectPath} already exists and is not empty. Aborting.`,
    )
  }

  console.log("Copying template...")
  await copyTemplate(TEMPLATE_DIR, absoluteProjectPath)

  console.log("Vendoring shared modules...")
  await vendorSharedModules(absoluteProjectPath)

  console.log("Generating package.json...")
  await buildPackageJson(absoluteProjectPath, projectName, port)

  console.log("Parameterizing project...")
  await parameterize(absoluteProjectPath, projectName)
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
          "An exercise service built with React using the Next.js framework and using Typescript..",
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
  const packageManager = await select({
    message: "Package manager",
    choices: [
      { name: "npm", value: "npm" },
      { name: "yarn", value: "yarn" },
      { name: "pnpm", value: "pnpm" },
    ],
  })
  const port = await input({
    message: "Development server port",
    default: "3002",
    validate: (value) => (/^\d+$/.test(value) && Number(value) > 0 && Number(value) < 65536) || "Enter a valid port number",
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
    await scaffoldReactProject({ projectName, absoluteProjectPath, port: Number(port) })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
    return
  }

  console.log(`
Done! Created exercise service "${projectName}" in ${absoluteProjectPath}

Next steps:
  cd ${projectPath}
  ${packageManager} install
  ${packageManager} run dev    # → http://localhost:${port}

Note: src/shared-module/ is a vendored snapshot of the @moocfi shared code. Re-run
create-exercise-service (or copy the packages over manually) to update it.
`)
}

// Only run the interactive CLI when executed directly, not when imported (e.g. by tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main()
}
