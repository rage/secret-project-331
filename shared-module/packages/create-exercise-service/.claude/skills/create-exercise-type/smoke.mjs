#!/usr/bin/env node
// Smoke driver for the create-exercise-service CLI.
//
// The CLI's job is to emit a *runnable* standalone exercise service from the
// services/example-exercise template. The repo's own `tests/scaffold.test.ts` already asserts the
// generated file structure; what nothing else checks is that the emitted project actually installs,
// builds, and serves the exercise-service HTTP contract. That runtime check is the thing that
// catches template drift (bundler/framework changes) — so it is what this driver adds on top of a
// quick structural sanity pass.
//
// Usage:
//   node smoke.mjs            # scaffold into a temp dir + structural assertions   (~seconds)
//   node smoke.mjs --boot     # ALSO pnpm install + boot the dev server + hit the endpoints (~1 min)
//   node smoke.mjs --keep     # don't delete the temp dir (inspect the output)
//
// Exit code 0 = all checks passed. Non-zero = a check failed (message on stderr).

import { execFileSync, spawn } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SKILL_DIR = dirname(fileURLToPath(import.meta.url))
// skill dir: <pkg>/.claude/skills/create-exercise-type  ->  <pkg> is three levels up.
const PKG_ROOT = resolve(SKILL_DIR, "../../..")

const args = new Set(process.argv.slice(2))
const BOOT = args.has("--boot")
const KEEP = args.has("--keep")
for (const a of args) {
  if (!["--boot", "--keep"].includes(a)) {
    console.warn(`  warn  unknown flag ${a} (known: --boot, --keep)`)
  }
}

const NAME = "smoke-exercise"
const DISPLAY = "Smoke exercise"
const PORT = 3998

let failures = 0
const ok = (m) => console.log(`  ok   ${m}`)
const bad = (m) => {
  console.error(`  FAIL ${m}`)
  failures++
}
const check = (cond, m) => (cond ? ok(m) : bad(m))

const out = mkdtempSync(join(tmpdir(), "ces-smoke-"))
console.log(`create-exercise-service smoke driver`)
console.log(`  pkg:  ${PKG_ROOT}`)
console.log(`  out:  ${out}`)

async function main() {
  // --- Scaffold (non-interactive path: the same scaffoldReactProject the CLI prompts drive) -------
  console.log(`\n[scaffold] pnpm exec tsx scripts/scaffold-to.ts ${out} ${NAME} ${PORT}`)
  execFileSync(
    "pnpm",
    ["--dir", PKG_ROOT, "exec", "tsx", "scripts/scaffold-to.ts", out, NAME, String(PORT)],
    { stdio: "inherit" },
  )

  // --- Structural assertions ----------------------------------------------------------------------
  // Overlaps tests/scaffold.test.ts on purpose: this driver must stand alone without `pnpm test`.
  console.log(`\n[structure]`)
  const pkg = JSON.parse(readFileSync(join(out, "package.json"), "utf8"))
  check(pkg.name === NAME, `package.json name === "${NAME}"`)
  check(pkg.scripts?.dev?.includes(`--port ${PORT}`), `dev script uses --port ${PORT}`)
  check(existsSync(join(out, "rsbuild.config.ts")), "rsbuild.config.ts present (TanStack Start stack)")
  check(existsSync(join(out, "server.mjs")), "server.mjs present")
  for (const p of [
    "exercise-protocol",
    "exercise-client",
    "exercise-react",
    "exercise-service-test-utils",
  ]) {
    check(existsSync(join(out, "src", "shared-module", p)), `vendored src/shared-module/${p}`)
  }
  check(existsSync(join(out, "playwright.config.ts")), "playwright.config.ts present (inherited e2e)")
  check(
    existsSync(join(out, "e2e", "protocol.spec.ts")),
    "e2e/protocol.spec.ts present (inherited e2e)",
  )
  const info = readFileSync(join(out, "src", "server", "serviceInfo.ts"), "utf8")
  check(info.includes(`service_name: "${DISPLAY}"`), `service-info service_name === "${DISPLAY}"`)
  check(
    existsSync(join(out, "src", "locales", "en", `${NAME}.json`)),
    `locale renamed to ${NAME}.json`,
  )
  // No stray template name in app source (the vendored shared-module legitimately keeps its own names).
  const stray = execFileSync(
    "bash",
    [
      "-c",
      `grep -rIl "example-exercise" ${JSON.stringify(join(out, "src"))} --exclude-dir=shared-module || true`,
    ],
    { encoding: "utf8" },
  ).trim()
  check(stray === "", "no leftover 'example-exercise' in src (outside shared-module)")

  // --- Boot the generated service and hit the exercise-service HTTP contract -----------------------
  if (BOOT) {
    await assertPortFree(PORT)

    console.log(`\n[boot] pnpm install (generated project) — this takes ~30s`)
    execFileSync("pnpm", ["--dir", out, "install"], { stdio: "inherit" })

    console.log(`[boot] starting dev server on :${PORT}`)
    // The port comes from the baked-in `--port ${PORT}` in the generated dev script, not from PORT.
    // We serve at the root (no base path) so the checks below can hit /api/... and /iframe directly.
    const dev = spawn("pnpm", ["--dir", out, "run", "dev"], {
      env: { ...process.env, PUBLIC_BASE_PATH: "" },
      stdio: "ignore",
      detached: true,
    })
    try {
      const base = `http://localhost:${PORT}`
      await waitFor(`${base}/api/service-info`, 60)

      const si = await (await fetch(`${base}/api/service-info`)).json()
      check(si.service_name === DISPLAY, `GET /api/service-info -> service_name "${DISPLAY}"`)
      check(
        typeof si.grade_endpoint_path === "string" && si.grade_endpoint_path.endsWith("/api/grade"),
        "service-info advertises grade_endpoint_path",
      )
      check(
        typeof si.public_spec_endpoint_path === "string",
        "service-info advertises public_spec_endpoint_path",
      )

      const iframe = await (await fetch(`${base}/iframe`)).text()
      check(iframe.includes("<!DOCTYPE html>"), "GET /iframe -> HTML document")
      check(iframe.includes(`<title>${DISPLAY}</title>`), `iframe <title> is "${DISPLAY}"`)

      // public-spec derivation: private spec (with `correct`) -> public spec (without it).
      const specReq = {
        request_id: "00000000-0000-0000-0000-000000000000",
        private_spec: [
          { id: "a", name: "Helsinki", correct: true },
          { id: "b", name: "Turku", correct: false },
        ],
        upload_url: null,
      }
      const pub = await (
        await fetch(`${base}/api/public-spec`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(specReq),
        })
      ).json()
      check(
        Array.isArray(pub) && pub.every((o) => !("correct" in o)),
        "POST /api/public-spec strips the `correct` flag (no answer leak)",
      )
    } finally {
      try {
        process.kill(-dev.pid) // kill the detached process group
      } catch {
        /* already gone */
      }
    }
  } else {
    console.log(`\n[boot] skipped (pass --boot to install + run the generated service)`)
  }

  console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures})`}`)
  if (!KEEP) {
    rmSync(out, { recursive: true, force: true })
  } else {
    console.log(`(kept ${out})`)
  }
  process.exit(failures === 0 ? 0 : 1)
}

/**
 * Reject if `port` is already bound. A leftover `--keep` server would otherwise satisfy every
 * `waitFor`/fetch check below, turning a boot failure of the *new* server into a false PASS.
 */
async function assertPortFree(port) {
  await new Promise((resolvePromise, reject) => {
    const srv = createServer()
    srv.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use (a previous --boot/--keep run may still be listening). ` +
              `Kill it by pid, not \`pkill -f\` (see SKILL.md Gotchas), and retry.`,
          ),
        )
      } else {
        reject(err)
      }
    })
    srv.once("listening", () => srv.close(() => resolvePromise()))
    srv.listen(port, "127.0.0.1")
  })
}

/** Poll a URL until it answers 2xx, or throw after `seconds`. */
async function waitFor(url, seconds) {
  for (let i = 0; i < seconds; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) {
        return
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

main().catch((e) => {
  console.error(e)
  if (!KEEP) {
    rmSync(out, { recursive: true, force: true })
  }
  process.exit(1)
})
