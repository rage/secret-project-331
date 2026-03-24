import { promises as fs } from "fs"
import path from "path"
import { temporaryDirectory, temporaryFile } from "tempy"

import { downloadStream } from "@/lib"
import { RunResult } from "@/tmc/cli"
import { isRunResult } from "@/tmc/cli.guard"
import { compressProject, extractProject, prepareSubmission } from "@/tmc/langs"
import { createLogger } from "@/util/logger"
import { runInSandboxPod } from "@/util/podExecution"

const { log, debug, error } = createLogger("test")

export type Submission =
  | {
      type: "browser"
      files: Array<{ filepath: string; contents: string }>
    }
  | {
      type: "editor"
      archiveDownloadUrl: string
    }

export const runTests = async (
  templateDownloadUrl: string,
  submission: Submission,
): Promise<RunResult> => {
  const tempPaths: string[] = []
  try {
    debug("prepare submission for the grading pod")
    const submissionArchivePath = temporaryFile()
    tempPaths.push(submissionArchivePath)
    if (submission.type === "editor") {
      debug("testing editor submission")
      await downloadStream(submission.archiveDownloadUrl, submissionArchivePath)
    } else if (submission.type === "browser") {
      debug("testing browser submission")
      const submissionDir = temporaryDirectory()
      tempPaths.push(submissionDir)
      for (const { filepath, contents } of submission.files) {
        if (filepath.includes("\0")) {
          throw new Error("Invalid filepath: null byte")
        }
        const resolved = path.resolve(submissionDir, filepath)
        const relative = path.relative(submissionDir, resolved)
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
          throw new Error(`Invalid filepath: path escapes submission dir: ${filepath}`)
        }
        if (!resolved.startsWith(submissionDir)) {
          throw new Error(`Invalid filepath: path escapes submission dir: ${filepath}`)
        }
        await fs.mkdir(path.dirname(resolved), { recursive: true })
        await fs.writeFile(resolved, contents)
      }
      debug("compressing project")
      await compressProject(submissionDir, submissionArchivePath, "zstd", true, log)
    } else {
      throw new Error("Unreachable")
    }

    debug("downloading exercise template")
    const templateArchivePath = temporaryFile()
    tempPaths.push(templateArchivePath)
    await downloadStream(templateDownloadUrl, templateArchivePath)

    debug("extracting template")
    const extractedTemplatePath = temporaryDirectory()
    tempPaths.push(extractedTemplatePath)
    await extractProject(templateArchivePath, extractedTemplatePath, log)
    log("template")
    const preparedSubmissionArchivePath = temporaryFile()
    tempPaths.push(preparedSubmissionArchivePath)
    const sandboxImage = await prepareSubmission(
      extractedTemplatePath,
      preparedSubmissionArchivePath,
      submissionArchivePath,
      "zstd",
      false,
      log,
    )

    const logger = createLogger("test")
    let outcome
    try {
      log("preparing pod")
      outcome = await runInSandboxPod(sandboxImage, preparedSubmissionArchivePath, logger)
    } catch (e) {
      error(`Failed to test in pod: ${e}`)
      return { status: "GENERIC_ERROR", testResults: [], logs: {} }
    }

    if (outcome.timedOut) {
      return { status: "GENERIC_ERROR", testResults: [], logs: {} }
    }

    if (isRunResult(outcome.parsed)) {
      return outcome.parsed
    } else {
      throw new Error("Unexpected results")
    }
  } finally {
    await Promise.allSettled(tempPaths.map((p) => fs.rm(p, { recursive: true, force: true })))
  }
}
