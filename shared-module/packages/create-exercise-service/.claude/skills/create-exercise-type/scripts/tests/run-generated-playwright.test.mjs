import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const RUNNER = resolve(dirname(fileURLToPath(import.meta.url)), "../run-generated-playwright.mjs")

const fakePackageManager = `#!/usr/bin/env node
import { appendFileSync } from "node:fs"
appendFileSync(process.env.FAKE_PM_LOG, JSON.stringify({ command: process.argv[1].split(/[\\\\/]/).at(-1), args: process.argv.slice(2) }) + "\\n")
if (process.argv.includes("--list")) process.stdout.write((process.env.FAKE_REPORT_PREFIX || "") + process.env.FAKE_REPORT + (process.env.FAKE_REPORT_SUFFIX || ""))
else process.exit(Number(process.env.FAKE_RUN_EXIT || 0))
`

function listedTest(level, project) {
  return {
    title: `${level} contract`,
    file: `${level}/contract.spec.ts`,
    tests: [{ projectId: project, projectName: project }],
  }
}

function report({ iframe = true, system = false } = {}) {
  const projects = [{ id: "plugin-contract-chromium", name: "plugin-contract-chromium" }]
  const specs = [listedTest("plugin-contract", "plugin-contract-chromium")]
  if (iframe) {
    projects.push(
      { id: "iframe-boundary-chromium", name: "iframe-boundary-chromium" },
      { id: "iframe-boundary-firefox", name: "iframe-boundary-firefox" },
      { id: "iframe-boundary-webkit", name: "iframe-boundary-webkit" },
    )
    specs.push(
      listedTest("iframe-boundary", "iframe-boundary-chromium"),
      listedTest("iframe-boundary", "iframe-boundary-firefox"),
      listedTest("iframe-boundary", "iframe-boundary-webkit"),
    )
  }
  if (system) {
    projects.push({ id: "system-chromium", name: "system-chromium" })
    specs.push(listedTest("system", "system-chromium"))
  }
  return {
    config: {
      rootDir: "/portable/project/playwright",
      projects,
      webServer: { command: "pnpm run dev", url: "http://localhost:3002/iframe" },
    },
    suites: [{ title: "contracts", specs }],
    errors: [],
  }
}

function fixture({ manager = "pnpm", listed = report(), systemFile = false, legacy = false, dependencies = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "generated-playwright-runner-"))
  const bin = join(root, "bin")
  const project = join(root, "project")
  const log = join(root, "commands.jsonl")
  mkdirSync(bin)
  mkdirSync(join(project, "playwright", "plugin-contract"), { recursive: true })
  mkdirSync(join(project, "playwright", "iframe-boundary"), { recursive: true })
  mkdirSync(join(project, "playwright", "fixtures"), { recursive: true })
  mkdirSync(join(project, "playwright", "system"), { recursive: true })
  writeFileSync(join(project, "playwright", "plugin-contract", "contract.spec.ts"), "// fixture\n")
  writeFileSync(join(project, "playwright", "iframe-boundary", "contract.spec.ts"), "// fixture\n")
  if (systemFile) {
    writeFileSync(join(project, "playwright", "system", "contract.spec.ts"), "// fixture\n")
  }
  if (legacy) mkdirSync(join(project, "e2e"))
  listed.config.rootDir = join(project, "playwright")
  writeFileSync(
    join(project, "package.json"),
    JSON.stringify({ name: "fixture", packageManager: `${manager}@1.0.0`, dependencies }),
  )
  writeFileSync(
    join(project, "playwright.config.ts"),
    'const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH\nexport default { use: { launchOptions: { executablePath } } }\n',
  )
  const executable = join(bin, manager)
  writeFileSync(executable, fakePackageManager)
  chmodSync(executable, 0o755)

  return {
    root,
    project,
    log,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      FAKE_PM_LOG: log,
      FAKE_REPORT: JSON.stringify(listed),
    },
  }
}

function invoke(fx, ...args) {
  return spawnSync(process.execPath, [RUNNER, ...args, fx.project], {
    encoding: "utf8",
    env: fx.env,
  })
}

function commands(fx) {
  return readFileSync(fx.log, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

test("lists first, runs focused layers, and finishes with an unfiltered pnpm suite", () => {
  const fx = fixture()
  try {
    const result = invoke(fx)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /browser hook: PLAYWRIGHT_CHROMIUM_PATH \(inactive; managed browser preferred\)/)
    const calls = commands(fx)
    assert.equal(calls.length, 4)
    assert.deepEqual(calls[0].args, ["exec", "playwright", "test", "--config=playwright.config.ts", "--list", "--reporter=json"])
    assert.deepEqual(calls[1].args, ["exec", "playwright", "test", "--config=playwright.config.ts", "--project=plugin-contract-chromium"])
    assert.deepEqual(calls[2].args, [
      "exec",
      "playwright",
      "test",
      "--config=playwright.config.ts",
      "--project=iframe-boundary-chromium",
      "--project=iframe-boundary-firefox",
      "--project=iframe-boundary-webkit",
    ])
    assert.deepEqual(calls[3].args, ["exec", "playwright", "test", "--config=playwright.config.ts"])
  } finally {
    rmSync(fx.root, { recursive: true, force: true })
  }
})

test("continues to the complete suite after a focused failure and exits non-zero", () => {
  const fx = fixture()
  fx.env.FAKE_RUN_EXIT = "7"
  try {
    const result = invoke(fx)
    assert.equal(result.status, 1)
    assert.equal(commands(fx).length, 4)
    assert.match(result.stderr, /required failing layers are incomplete verification/)
  } finally {
    rmSync(fx.root, { recursive: true, force: true })
  }
})

test("supports npm and yarn invocation without global Playwright", async (t) => {
  for (const manager of ["npm", "yarn"]) {
    await t.test(manager, () => {
      const fx = fixture({ manager })
      try {
        if (manager === "yarn") {
          fx.env.FAKE_REPORT_PREFIX = "yarn exec v1.22.22\n"
          fx.env.FAKE_REPORT_SUFFIX = "\nDone in 0.12s.\n"
        }
        const result = invoke(fx, "--dry-run")
        assert.equal(result.status, 0, result.stderr)
        const [call] = commands(fx)
        assert.equal(call.command, manager)
        assert.deepEqual(
          call.args,
          manager === "npm"
            ? ["exec", "--", "playwright", "test", "--config=playwright.config.ts", "--list", "--reporter=json"]
            : ["exec", "playwright", "test", "--config=playwright.config.ts", "--list", "--reporter=json"],
        )
      } finally {
        rmSync(fx.root, { recursive: true, force: true })
      }
    })
  }
})

test("rejects zero/missing required layers, legacy paths, and absolute dependency paths", async (t) => {
  const cases = [
    { name: "zero tests", options: { listed: { ...report(), suites: [] } }, error: /listed zero tests/ },
    { name: "missing iframe tests", options: { listed: report({ iframe: false }) }, error: /zero tests for required level: iframe-boundary/ },
    { name: "legacy e2e", options: { legacy: true }, error: /Legacy e2e\/ path is forbidden/ },
    {
      name: "absolute dependency",
      options: { dependencies: { "@moocfi/exercise-client": "file:/data/build/exercise-client.tgz" } },
      error: /non-portable absolute dependency path/,
    },
  ]
  for (const item of cases) {
    await t.test(item.name, () => {
      const fx = fixture(item.options)
      try {
        const result = invoke(fx, "--dry-run")
        assert.equal(result.status, 1)
        assert.match(result.stderr, item.error)
      } finally {
        rmSync(fx.root, { recursive: true, force: true })
      }
    })
  }
})

test("auto and required system modes fail loudly when system coverage is not listed", async (t) => {
  for (const item of [
    { name: "auto discovers a system spec on disk", options: { systemFile: true }, args: [] },
    { name: "required insists on a system level", options: {}, args: ["--system=required"] },
  ]) {
    await t.test(item.name, () => {
      const fx = fixture(item.options)
      try {
        const result = invoke(fx, "--dry-run", ...item.args)
        assert.equal(result.status, 1)
        assert.match(result.stderr, /Playwright listed zero system tests|System coverage is required/)
      } finally {
        rmSync(fx.root, { recursive: true, force: true })
      }
    })
  }
})

test("auto accepts and reports discovered system coverage", () => {
  const fx = fixture({ listed: report({ system: true }), systemFile: true })
  try {
    const result = invoke(fx, "--dry-run")
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /system policy: auto \(tests discovered\)/)
  } finally {
    rmSync(fx.root, { recursive: true, force: true })
  }
})

test("requires the complete directory hierarchy and rejects specs in support or ad-hoc paths", async (t) => {
  await t.test("missing system directory", () => {
    const fx = fixture()
    try {
      rmSync(join(fx.project, "playwright", "system"), { recursive: true, force: true })
      const result = invoke(fx, "--dry-run")
      assert.equal(result.status, 1)
      assert.match(result.stderr, /Missing required Playwright level: playwright\/system\//)
    } finally {
      rmSync(fx.root, { recursive: true, force: true })
    }
  })

  for (const level of ["fixtures", "misc-browser-tests"]) {
    await t.test(`listed spec under ${level}`, () => {
      const listed = report()
      listed.suites[0].specs.push(listedTest(level, "plugin-contract-chromium"))
      const fx = fixture({ listed })
      try {
        const result = invoke(fx, "--dry-run")
        assert.equal(result.status, 1)
        assert.match(result.stderr, /outside the allowed playwright\/ levels/)
      } finally {
        rmSync(fx.root, { recursive: true, force: true })
      }
    })
  }
})
