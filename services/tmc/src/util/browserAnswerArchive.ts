import { promises as fs } from "fs"
import path from "path"

import { compressProject } from "@/tmc/langs"
import type { ExerciseFile } from "@/util/stateInterfaces"

/**
 * Writes a browser answer's files under `dir`.
 *
 * `filepath` comes from the student, so every entry is checked to stay inside `dir` — a `..`
 * segment or an absolute path would otherwise write anywhere the service can reach.
 */
export async function writeBrowserAnswerFiles(
  dir: string,
  files: readonly ExerciseFile[],
): Promise<void> {
  for (const { filepath, contents } of files) {
    if (filepath.includes("\0")) {
      throw new Error("Invalid filepath: null byte")
    }
    const resolved = path.resolve(dir, filepath)
    const relative = path.relative(dir, resolved)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Invalid filepath: path escapes submission dir: ${filepath}`)
    }
    if (!resolved.startsWith(dir)) {
      throw new Error(`Invalid filepath: path escapes submission dir: ${filepath}`)
    }
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, contents)
  }
}

/**
 * Packs a browser answer into the same kind of project archive an editor answer already is.
 *
 * `dir` and `archivePath` are the caller's to clean up.
 */
export async function compressBrowserAnswer(
  dir: string,
  archivePath: string,
  files: readonly ExerciseFile[],
  log: (message: string, ...optionalParams: unknown[]) => void,
): Promise<void> {
  await writeBrowserAnswerFiles(dir, files)
  await compressProject(dir, archivePath, "zstd", true, log)
}
