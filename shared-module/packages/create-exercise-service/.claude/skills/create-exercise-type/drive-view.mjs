#!/usr/bin/env node
// Driver for the runtime iframe-protocol flow: boot an exercise service, play the host, push a view,
// and read back the `current-state` the iframe emits. This is the one capability `smoke.mjs` doesn't
// cover — smoke.mjs checks the HTTP contract; this checks the *iframe* contract (handshake + set-state
// + current-state) against a real browser, which is otherwise only reachable by hand-assembling
// `playwright-cli` commands.
//
// It drives `services/example-exercise` (the template the CLI copies), so it doubles as a smoke test
// of the emulator + protocol themselves. To drive YOUR generated service instead, boot it and pass
// its URL with --base (see Usage); the flow is identical, only the pushed `public_spec` differs.
//
// Usage:
//   node drive-view.mjs                       # boot example-exercise on :3002, drive it, tear down
//   node drive-view.mjs --base http://localhost:3998   # attach to an already-running service
//   node drive-view.mjs --screenshot view.png # also save a screenshot of the driven view
//   node drive-view.mjs --keep-open           # leave the browser session open for manual poking
//
// Exit 0 = the iframe handshook and emitted the expected current-state. Non-zero = a step failed.
//
// Requires `playwright-cli` + `chromium` on PATH (both are in this repo's Nix dev shell). In that
// shell Playwright's managed browsers aren't installed, so we point it at the system chromium.

import { execFileSync, spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SKILL_DIR = dirname(fileURLToPath(import.meta.url))
// skill dir -> .claude/skills -> .claude -> create-exercise-service -> packages -> shared-module -> repo root
const REPO_ROOT = resolve(SKILL_DIR, "../../../../../..")
const EMULATOR = resolve(
  REPO_ROOT,
  "shared-module/packages/exercise-service-test-utils/src/browser/hostEmulator.js",
)
const EXAMPLE_EXERCISE = resolve(REPO_ROOT, "services/example-exercise")

const KNOWN_FLAGS = new Set(["--base", "--screenshot", "--keep-open"])
const args = process.argv.slice(2)
for (const a of args) {
  if (a.startsWith("--") && !KNOWN_FLAGS.has(a.split("=")[0])) {
    console.warn(`  warn  unknown flag ${a} (known: ${[...KNOWN_FLAGS].join(", ")})`)
  }
}
// Read a `--name value` or `--name=value` flag. Warns (and returns undefined) if the flag is present
// but its value is missing, so a bare `--base` doesn't silently fall back to boot mode.
const flag = (name) => {
  const eq = args.find((a) => a.startsWith(`${name}=`))
  if (eq) {
    return eq.slice(name.length + 1)
  }
  const i = args.indexOf(name)
  if (i < 0) {
    return undefined
  }
  const val = args[i + 1]
  if (val === undefined || val.startsWith("--")) {
    console.warn(`  warn  ${name} needs a value; ignoring it`)
    return undefined
  }
  return val
}
const BASE = flag("--base") // undefined ⇒ boot example-exercise ourselves
const SCREENSHOT = flag("--screenshot")
const KEEP_OPEN = args.includes("--keep-open")

const PORT = 3002
const SESSION = "drive-view" // dedicated session so we don't clobber an interactive playwright-cli
const CHROMIUM = execFileSync("bash", ["-c", "command -v chromium || true"], { encoding: "utf8" }).trim()
if (!CHROMIUM) {
  console.warn(
    "  warn  no `chromium` on PATH — relying on Playwright's managed browsers (run " +
      "`playwright-cli`'s browser install if the first step fails with 'browser not found').",
  )
}

let failures = 0
const ok = (m) => console.log(`  ok   ${m}`)
const bad = (m) => {
  console.error(`  FAIL ${m}`)
  failures++
}

/** Run a playwright-cli subcommand in our session and return stdout. */
function pw(...cliArgs) {
  return execFileSync("playwright-cli", [`-s=${SESSION}`, ...cliArgs], {
    encoding: "utf8",
    env: { ...process.env, ...(CHROMIUM ? { PLAYWRIGHT_CHROMIUM_PATH: CHROMIUM } : {}) },
  })
}

/** Evaluate a JS function in the page and return its result parsed from the "### Result" block. */
function evalInPage(func) {
  const out = pw("eval", func)
  const start = out.indexOf("### Result")
  if (start < 0) {
    throw new Error(`playwright-cli eval printed no result:\n${out}`)
  }
  let block = out.slice(start + "### Result".length)
  // The result runs until the next "### " section (e.g. "### Ran Playwright code" when codegen is on,
  // "### Page" when it's off) — cut generically so we don't depend on which follows.
  const end = block.search(/\n### /)
  if (end >= 0) {
    block = block.slice(0, end)
  }
  block = block.trim()
  try {
    return JSON.parse(block)
  } catch {
    return block // non-JSON (e.g. undefined) — hand back the raw text
  }
}

/** Is a service already answering on `base`? One quick probe, no retries. */
async function isServing(base) {
  try {
    return (await fetch(`${base}/api/service-info`)).ok
  } catch {
    return false
  }
}

async function waitForService(base, seconds) {
  for (let i = 0; i < seconds; i++) {
    if (await isServing(base)) {
      return
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Timed out waiting for ${base}/api/service-info`)
}

async function main() {
  const base = BASE || `http://localhost:${PORT}`
  let dev // set only when WE spawn the server (so teardown only kills our own)

  if (BASE) {
    console.log(`[attach] using already-running service at ${base}`)
  } else if (await isServing(base)) {
    // :3002 is example-exercise's own default, so bin/dev or a prior --keep-open run may already hold
    // it. Attach to whatever is there rather than spawning a second server that fights for the port.
    console.log(`[attach] :${PORT} is already serving — attaching instead of booting a second server`)
  } else {
    console.log(`[boot] starting services/example-exercise on :${PORT} (PUBLIC_BASE_PATH="")`)
    dev = spawn("pnpm", ["--dir", EXAMPLE_EXERCISE, "run", "dev"], {
      env: { ...process.env, PUBLIC_BASE_PATH: "" },
      stdio: "ignore",
      detached: true,
    })
    await waitForService(base, 60)
  }

  try {
    // 1. Open the iframe FIRST so it mounts and starts posting "ready" for the handshake.
    pw("open", `${base}/iframe`)

    // 2. Inject the emulator: installs window.__host and hands the iframe a MessagePort. It waits for
    //    the iframe's "ready", so injection order relative to the handshake doesn't matter.
    pw("eval", readFileSync(EMULATOR, "utf8"))
    const installed = evalInPage("() => typeof window.__host === 'object'")
    installed === true ? ok("emulator installed (window.__host present)") : bad("emulator not installed")

    // 3. Push the answer-exercise view with a two-option public spec.
    pw(
      "eval",
      "() => window.__host.setState('answer-exercise', { public_spec: [{ id: 'a', name: 'Helsinki' }, { id: 'b', name: 'Tampere' }], previous_submission: null })",
    )

    // 4. The iframe should switch to that view — its set-state ack is the view rendering the options.
    const snapshot = pw("snapshot")
    const tampere = snapshot.split("\n").find((l) => /checkbox "Tampere"/.test(l))
    tampere ? ok('answer-exercise rendered ("Tampere" checkbox present)') : bad("answer view did not render")
    const ref = tampere && /\[ref=(e\d+)\]/.exec(tampere)?.[1]

    // 5. Pick "Tampere" (id "b") and read back the current-state the iframe emits.
    if (ref) {
      pw("click", ref)
    } else {
      bad("no checkbox ref found in snapshot; cannot click")
    }
    const current = evalInPage("() => window.__host.last('current-state')")
    const selected = current?.data?.selectedOptionId
    selected === "b"
      ? ok(`current-state reports selectedOptionId "b" (valid=${current?.valid})`)
      : bad(`current-state.selectedOptionId was ${JSON.stringify(selected)}, expected "b"`)

    if (SCREENSHOT) {
      pw("screenshot", "--filename", resolve(SCREENSHOT))
      ok(`screenshot saved to ${resolve(SCREENSHOT)}`)
    }
  } finally {
    if (KEEP_OPEN) {
      console.log(`(browser session "${SESSION}" left open — 'playwright-cli -s=${SESSION} close' to end it)`)
      if (dev) {
        console.log(`(dev server left running on :${PORT}, pid ${dev.pid} — 'kill ${dev.pid}' to stop it)`)
      }
    } else {
      try {
        pw("close")
      } catch {
        /* session may already be gone */
      }
      if (dev) {
        try {
          process.kill(-dev.pid) // kill the detached dev-server process group we spawned
        } catch {
          /* already gone */
        }
      }
    }
  }

  console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures})`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
