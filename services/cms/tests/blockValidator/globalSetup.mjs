import { execFileSync } from "child_process"
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import path from "path"

const CMS_ROOT = path.join(import.meta.dirname, "..", "..")

/** Builds the production worker bundle once per run, so validator tests exercise what ships. */
export default function buildBlockValidatorBundle() {
  const outfile = path.join(mkdtempSync(path.join(tmpdir(), "block-validator-")), "worker.cjs")
  execFileSync(
    process.execPath,
    [path.join(CMS_ROOT, "scripts", "buildBlockValidatorWorker.mjs"), "--outfile", outfile],
    { cwd: CMS_ROOT, stdio: "ignore" },
  )
  // Test workers start after global setup and inherit this.
  process.env.BUILT_BLOCK_VALIDATOR_PATH = outfile
}
