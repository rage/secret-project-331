import { promises as fs } from "fs"

import { temporaryDirectory, temporaryFile } from "tempy"

import { downloadStream } from "@/lib"
import type { RunResult } from "@/tmc/cli"
import { isRunResult } from "@/tmc/cli.guard"
import { extractProject, prepareSubmission } from "@/tmc/langs"
import { compressBrowserAnswer } from "@/util/browserAnswerArchive"
import { createLogger } from "@/util/logger"
import { runInSandboxPod } from "@/util/podExecution"

const { log, debug, error } = createLogger("test")

export type Submission =
  | {
      type: "browser"
      files: { filepath: string; contents: string }[]
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
      debug("compressing project")
      await compressBrowserAnswer(submissionDir, submissionArchivePath, submission.files, log)
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
    }
    throw new Error("Unexpected results")
  } finally {
    await Promise.allSettled(tempPaths.map((p) => fs.rm(p, { recursive: true, force: true })))
  }
}
