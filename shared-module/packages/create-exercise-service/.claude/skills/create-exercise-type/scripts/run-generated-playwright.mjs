#!/usr/bin/env node

/**
 * Verify the browser-integration layers of a generated exercise service.
 *
 * This driver intentionally delegates browser and web-server lifecycle to the generated
 * project's pinned Playwright installation/configuration. It never installs a browser or an OS
 * package, and it never guesses a system-browser executable from PATH.
 */

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

const CONFIG_NAMES = [
  "playwright.config.ts",
  "playwright.config.mts",
  "playwright.config.cts",
  "playwright.config.js",
  "playwright.config.mjs",
  "playwright.config.cjs",
]
const SYSTEM_MODES = new Set(["auto", "required", "optional"])

function usage() {
  return `Usage: node run-generated-playwright.mjs [options] [project-directory]

Discover and verify a generated exercise service's Playwright hierarchy.

Options:
  --project-dir <path>    Project directory (default: positional path or current directory)
  --config <path>         Playwright config relative to the project (default: discover it)
  --system <mode>         auto | required | optional (default: auto)
                          auto requires system tests when playwright/system contains specs;
                          required always requires them; optional permits their absence.
                          Any discovered system tests still run in the final full suite.
  --no-focused            Skip the preliminary level-focused runs
  --dry-run               List/discover tests and print the run plan without executing it
  -h, --help              Show this help

The driver first asks Playwright to list its tests, validates plugin-contract and iframe-boundary
coverage (plus system coverage according to --system), runs useful focused project groups, and
always finishes the execution phase with a complete unfiltered Playwright suite. It uses the
project's package manager and Playwright-managed browsers by default. A system browser is used only
when the project's config exposes an executable-path environment hook and that variable is set.
The driver never runs playwright install, npx browser installers, sudo, apt, dnf, yum, or apk.`
}

function fail(message) {
  const error = new Error(message)
  error.name = "PreflightError"
  throw error
}

function readValue(args, index, name) {
  const current = args[index]
  const prefix = `${name}=`
  if (current.startsWith(prefix)) {
    const value = current.slice(prefix.length)
    if (!value) fail(`${name} requires a value`)
    return { value, consumed: 1 }
  }
  const value = args[index + 1]
  if (value === undefined || value.startsWith("--")) fail(`${name} requires a value`)
  return { value, consumed: 2 }
}

function parseArgs(argv) {
  let projectDir
  let config
  let system = "auto"
  let focused = true
  let dryRun = false

  for (let i = 0; i < argv.length; ) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") return { help: true }
    if (arg === "--no-focused") {
      focused = false
      i++
      continue
    }
    if (arg === "--dry-run") {
      dryRun = true
      i++
      continue
    }
    if (arg === "--project-dir" || arg.startsWith("--project-dir=")) {
      const parsed = readValue(argv, i, "--project-dir")
      if (projectDir) fail("Specify the project directory only once")
      projectDir = parsed.value
      i += parsed.consumed
      continue
    }
    if (arg === "--config" || arg.startsWith("--config=")) {
      const parsed = readValue(argv, i, "--config")
      if (config) fail("Specify --config only once")
      config = parsed.value
      i += parsed.consumed
      continue
    }
    if (arg === "--system" || arg.startsWith("--system=")) {
      const parsed = readValue(argv, i, "--system")
      if (!SYSTEM_MODES.has(parsed.value)) {
        fail(`Unknown --system mode ${JSON.stringify(parsed.value)}; use auto, required, or optional`)
      }
      system = parsed.value
      i += parsed.consumed
      continue
    }
    if (arg.startsWith("-")) fail(`Unknown option ${arg}`)
    if (projectDir) fail("Specify the project directory only once")
    projectDir = arg
    i++
  }

  return { help: false, projectDir: resolve(projectDir ?? process.cwd()), config, system, focused, dryRun }
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    fail(`Cannot read ${label} at ${path}: ${error.message}`)
  }
}

function discoverPackageManager(projectDir, pkg) {
  const declared = typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : null
  if (declared && !["npm", "pnpm", "yarn"].includes(declared)) {
    fail(`Unsupported packageManager ${JSON.stringify(pkg.packageManager)}; use npm, pnpm, or yarn`)
  }
  if (declared) return declared

  const locks = [
    ["pnpm", "pnpm-lock.yaml"],
    ["npm", "package-lock.json"],
    ["npm", "npm-shrinkwrap.json"],
    ["yarn", "yarn.lock"],
  ].filter(([, file]) => existsSync(join(projectDir, file)))
  const managers = [...new Set(locks.map(([manager]) => manager))]
  if (managers.length === 0) {
    fail("Cannot discover a package manager: add packageManager or an npm/pnpm/yarn lockfile")
  }
  if (managers.length > 1) {
    fail(`Ambiguous package manager lockfiles (${managers.join(", ")}); set packageManager`)
  }
  return managers[0]
}

function discoverConfig(projectDir, requested) {
  if (requested) {
    const path = resolve(projectDir, requested)
    if (!existsSync(path) || !statSync(path).isFile()) fail(`Playwright config does not exist: ${path}`)
    return path
  }
  const found = CONFIG_NAMES.map((name) => join(projectDir, name)).filter(existsSync)
  if (found.length === 0) fail(`No Playwright config found in ${projectDir}`)
  if (found.length > 1) fail(`Multiple Playwright configs found; choose one with --config: ${found.join(", ")}`)
  return found[0]
}

function assertPortableDependencySpecifiers(pkg) {
  const groups = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
  const absoluteLocal = /^(?:file|link|portal):(?:\/{1,3}|[A-Za-z]:[\\/]|\\\\)/
  for (const group of groups) {
    for (const [name, specifier] of Object.entries(pkg[group] ?? {})) {
      if (typeof specifier !== "string") continue
      if (absoluteLocal.test(specifier) || isAbsolute(specifier)) {
        fail(`${group}.${name} contains a non-portable absolute dependency path: ${specifier}`)
      }
    }
  }
}

function packageManagerCommand(manager, playwrightArgs) {
  if (manager === "pnpm") return { command: "pnpm", args: ["exec", "playwright", "test", ...playwrightArgs] }
  if (manager === "npm") return { command: "npm", args: ["exec", "--", "playwright", "test", ...playwrightArgs] }
  return { command: "yarn", args: ["exec", "playwright", "test", ...playwrightArgs] }
}

function displayCommand(command, args) {
  const quote = (value) => (/^[A-Za-z0-9_./:=,@+-]+$/.test(value) ? value : JSON.stringify(value))
  return [command, ...args].map(quote).join(" ")
}

function run(projectDir, manager, args, { capture = false } = {}) {
  const invocation = packageManagerCommand(manager, args)
  console.log(`\n$ ${displayCommand(invocation.command, invocation.args)}`)
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: projectDir,
    env: process.env,
    encoding: "utf8",
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
  })
  if (result.error) fail(`Could not run ${invocation.command}: ${result.error.message}`)
  if (capture && result.stderr) process.stderr.write(result.stderr)
  return result
}

function parseListReport(stdout) {
  if (!stdout?.trim()) fail("Playwright --list produced no JSON report")
  try {
    return JSON.parse(stdout)
  } catch (directError) {
    // Yarn Classic and some package-manager wrappers print a banner around child stdout. Keep the
    // Playwright JSON reporter authoritative while tolerating that wrapper text.
    const start = stdout.indexOf("{")
    const end = stdout.lastIndexOf("}")
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stdout.slice(start, end + 1))
      } catch {
        // Fall through to the useful original parse error below.
      }
    }
    fail(`Playwright --list did not produce valid JSON: ${directError.message}`)
  }
}

function collectTests(suites, output = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        output.push({ file: spec.file ?? suite.file ?? "", title: spec.title ?? "", project: test.projectName ?? test.projectId ?? "" })
      }
    }
    collectTests(suite.suites, output)
  }
  return output
}

function normalizeFile(file) {
  return String(file).replaceAll("\\", "/").replace(/^\.\//, "")
}

function levelForFile(file) {
  return normalizeFile(file).split("/")[0]
}

function hasSpecs(path) {
  if (!existsSync(path) || !statSync(path).isDirectory()) return false
  return readdirSync(path, { withFileTypes: true }).some((entry) => {
    const child = join(path, entry.name)
    return entry.isDirectory() ? hasSpecs(child) : /\.spec\.[cm]?[jt]sx?$/.test(entry.name)
  })
}

function assertNoLegacyE2e(projectDir, report) {
  const legacy = join(projectDir, "e2e")
  if (existsSync(legacy)) fail(`Legacy e2e/ path is forbidden; move browser tests to playwright/: ${legacy}`)
  const rootDir = report.config?.rootDir
  if (rootDir && normalizeFile(rootDir).split("/").includes("e2e")) {
    fail(`Playwright testDir still points at a legacy e2e path: ${rootDir}`)
  }
}

function discoverBrowserHooks(configPath, pkg) {
  const source = `${readFileSync(configPath, "utf8")}\n${Object.values(pkg.scripts ?? {}).join("\n")}`
  const variables = new Set()
  for (const match of source.matchAll(/process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\])/g)) {
    const name = match[1] ?? match[2]
    if (/(?:PLAYWRIGHT|CHROM|FIREFOX|WEBKIT|BROWSER).*(?:PATH|EXECUTABLE)|(?:PATH|EXECUTABLE).*(?:PLAYWRIGHT|CHROM|FIREFOX|WEBKIT|BROWSER)/.test(name)) {
      variables.add(name)
    }
  }
  return [...variables].sort()
}

function summarizeDiscovery(projectDir, manager, configPath, report, tests, hooks) {
  console.log("\n[discovery]")
  console.log(`  project: ${projectDir}`)
  console.log(`  package manager: ${manager}`)
  console.log(`  config: ${relative(projectDir, configPath) || basename(configPath)}`)
  console.log(`  testDir: ${report.config?.rootDir ?? "(not reported)"}`)
  const projects = (report.config?.projects ?? []).map((project) => project.name ?? project.id)
  console.log(`  projects: ${projects.join(", ") || "(none)"}`)
  const servers = Array.isArray(report.config?.webServer)
    ? report.config.webServer
    : report.config?.webServer
      ? [report.config.webServer]
      : []
  if (servers.length === 0) console.log("  web server: none configured")
  for (const server of servers) {
    console.log(`  web server: ${server.command ?? "(command hidden)"} -> ${server.url ?? "(no URL reported)"}`)
  }
  if (hooks.length === 0) {
    console.log("  browsers: Playwright-managed pinned executables (no system hook discovered)")
  } else {
    for (const hook of hooks) {
      const active = process.env[hook]
      console.log(`  browser hook: ${hook} (${active ? "active; config controls executable" : "inactive; managed browser preferred"})`)
    }
  }
  console.log(`  tests: ${tests.length}`)
  for (const test of tests) console.log(`    [${test.project}] ${normalizeFile(test.file)} › ${test.title}`)
}

function validateHierarchy(projectDir, report, tests, systemMode) {
  assertNoLegacyE2e(projectDir, report)
  const playwrightDir = join(projectDir, "playwright")
  if (report.config?.rootDir && resolve(report.config.rootDir) !== resolve(playwrightDir)) {
    fail(`Playwright testDir must be the project playwright/ directory, but it is ${report.config.rootDir}`)
  }
  for (const level of ["plugin-contract", "iframe-boundary"]) {
    const path = join(playwrightDir, level)
    if (!existsSync(path) || !statSync(path).isDirectory()) fail(`Missing required Playwright level: playwright/${level}/`)
    if (!tests.some((test) => levelForFile(test.file) === level)) fail(`Playwright listed zero tests for required level: ${level}`)
  }
  const fixturesDir = join(playwrightDir, "fixtures")
  if (!existsSync(fixturesDir) || !statSync(fixturesDir).isDirectory()) {
    fail("Missing required Playwright support directory: playwright/fixtures/")
  }
  const systemDir = join(playwrightDir, "system")
  if (!existsSync(systemDir) || !statSync(systemDir).isDirectory()) {
    fail("Missing required Playwright level: playwright/system/")
  }
  const allowedLevels = new Set(["plugin-contract", "iframe-boundary", "system"])
  const misplaced = tests.find((test) => !allowedLevels.has(levelForFile(test.file)))
  if (misplaced) {
    fail(
      `Browser spec ${normalizeFile(misplaced.file)} is outside the allowed playwright/ levels ` +
        "(plugin-contract, iframe-boundary, system); fixtures is support-only",
    )
  }
  const systemSpecs = hasSpecs(systemDir)
  const systemListed = tests.some((test) => levelForFile(test.file) === "system")
  const requireSystem =
    systemMode === "required" || (systemMode === "auto" && (systemSpecs || systemListed))
  if (requireSystem && !systemListed) fail(`System coverage is ${systemMode === "required" ? "required" : "present on disk"}, but Playwright listed zero system tests`)

  const projects = new Set((report.config?.projects ?? []).map((project) => project.name ?? project.id))
  for (const level of ["plugin-contract", "iframe-boundary", ...(requireSystem ? ["system"] : [])]) {
    const matching = [...projects].filter((name) => String(name).startsWith(`${level}-`))
    if (matching.length === 0) fail(`No named Playwright project found for level ${level} (expected ${level}-<browser>)`)
    if (!tests.some((test) => matching.includes(test.project) && levelForFile(test.file) === level)) {
      fail(`Named ${level} projects contain zero listed ${level} tests`)
    }
  }
  return { requireSystem, systemListed }
}

function selectedFocusedProjects(report) {
  const names = (report.config?.projects ?? []).map((project) => project.name ?? project.id).filter(Boolean)
  const plugin = names.filter((name) => String(name).startsWith("plugin-contract-"))
  const pluginChromium = plugin.filter((name) => /chromium/i.test(name))
  return [pluginChromium.length ? pluginChromium : plugin, names.filter((name) => String(name).startsWith("iframe-boundary-"))].filter((group) => group.length)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  const projectDir = options.projectDir
  if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) fail(`Project directory does not exist: ${projectDir}`)
  const packagePath = join(projectDir, "package.json")
  if (!existsSync(packagePath)) fail(`No package.json found in ${projectDir}`)
  const pkg = readJson(packagePath, "package.json")
  assertPortableDependencySpecifiers(pkg)
  const manager = discoverPackageManager(projectDir, pkg)
  const configPath = discoverConfig(projectDir, options.config)
  const configArg = relative(projectDir, configPath).split(sep).join("/")

  console.log("[list] asking the project's pinned Playwright to enumerate the complete suite")
  const listed = run(projectDir, manager, [`--config=${configArg}`, "--list", "--reporter=json"], { capture: true })
  if (listed.status !== 0) fail(`Playwright test listing failed with exit code ${listed.status}`)
  const report = parseListReport(listed.stdout)
  if (report.errors?.length) fail(`Playwright reported configuration/listing errors: ${JSON.stringify(report.errors)}`)
  const tests = collectTests(report.suites)
  if (tests.length === 0) fail("Playwright listed zero tests")
  const hooks = discoverBrowserHooks(configPath, pkg)
  summarizeDiscovery(projectDir, manager, configPath, report, tests, hooks)
  const hierarchy = validateHierarchy(projectDir, report, tests, options.system)
  console.log(`  system policy: ${options.system} (${hierarchy.systemListed ? "tests discovered" : "no tests discovered"})`)

  const focusedGroups = options.focused ? selectedFocusedProjects(report) : []
  console.log("\n[plan]")
  for (const group of focusedGroups) console.log(`  focused: ${group.join(", ")}`)
  console.log("  final: complete unfiltered Playwright suite")
  if (options.dryRun) {
    console.log("\nDRY RUN PASS (listing and preflight succeeded; browser tests were not executed)")
    return
  }

  let failed = false
  for (const group of focusedGroups) {
    const result = run(projectDir, manager, [`--config=${configArg}`, ...group.map((name) => `--project=${name}`)])
    if (result.status !== 0) failed = true
  }

  console.log("\n[final] running the complete suite with no test or project filter")
  const complete = run(projectDir, manager, [`--config=${configArg}`])
  if (complete.status !== 0) failed = true
  if (failed) fail("One or more Playwright runs failed; required failing layers are incomplete verification")
  console.log("\nPASS: all discovered browser-integration layers and the complete suite passed")
}

main().catch((error) => {
  console.error(`\nFAIL: ${error.message}`)
  process.exitCode = 1
})
