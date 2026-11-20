import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "../dev-cluster-route.mjs")

test("prints the manifests when run from a path that needs URL encoding", () => {
  const base = mkdtempSync(join(tmpdir(), "dev-cluster-route-"))
  try {
    const dir = join(base, "with space%20and percent")
    mkdirSync(dir)
    const copy = join(dir, "dev-cluster-route.mjs")
    copyFileSync(SCRIPT, copy)
    const result = spawnSync(process.execPath, [copy, "my-exercise", "3020"], { encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /name: my-exercise/)
    assert.match(result.stdout, /path: \/my-exercise/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
