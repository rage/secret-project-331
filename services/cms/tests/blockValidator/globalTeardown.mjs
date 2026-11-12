import { rmSync } from "fs"
import path from "path"

/** Removes the worker bundle global setup built; it is about 30 MB. */
export default function removeBlockValidatorBundle() {
  const outfile = process.env.BUILT_BLOCK_VALIDATOR_PATH
  if (outfile) {
    rmSync(path.dirname(outfile), { recursive: true, force: true })
  }
}
