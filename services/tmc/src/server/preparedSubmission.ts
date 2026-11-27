import { promises as fs } from "fs"

import { temporaryDirectory, temporaryFile } from "tempy"

import { downloadStream } from "@/lib"
import type { Compression } from "@/tmc/cli"
import {
  extractProject,
  fastAvailablePoints,
  getTestsTimeoutMs,
  prepareSubmission,
} from "@/tmc/langs"
import { ZIP_ARCHIVE_EXTENSION } from "@/util/archiveTypes"
import { createLogger } from "@/util/logger"

import type { GradingRequestFile } from "./requestSchemas"

const { log, debug } = createLogger("grade")

/**
 * Gradings prepared at once in this process. Each holds its archives on disk and a sandbox pod or
 * dispatch in memory, and the service's own memory limit is small; the rest wait their turn.
 */
const MAX_CONCURRENT_GRADINGS = 4
let runningGradings = 0
const waitingGradings: (() => void)[] = []

/** tmc-langs' naive submission extraction, which a project archive never needs. */
const EXTRACT_SUBMISSION_NAIVELY = false

/** Runs `grade` once fewer than `MAX_CONCURRENT_GRADINGS` others run. */
export async function withGradingSlot<T>(grade: () => Promise<T>): Promise<T> {
  if (runningGradings >= MAX_CONCURRENT_GRADINGS) {
    await new Promise<void>((resolve) => {
      waitingGradings.push(resolve)
    })
  } else {
    runningGradings++
  }
  try {
    return await grade()
  } finally {
    const next = waitingGradings.shift()
    if (next) {
      next()
    } else {
      runningGradings--
    }
  }
}

/** Where the host serves an answer and its exercise template. The URLs are claimed and expire. */
export interface SubmissionSource {
  answer: Pick<GradingRequestFile, "name" | "mime"> & { downloadUrl: string }
  templateDownloadUrl: string
}

/** An answer packed with its template for a sandbox, valid while `withPreparedSubmission`'s callback runs. */
export interface PreparedSubmission {
  /** The `.tar.zst` tmc-langs' prepare-submission wrote. */
  archivePath: string
  image: string
  points: string[]
  testsTimeoutMs: number
}

/**
 * The exercise template could not be extracted or read. The fault is the service's, so the student
 * gets the server-error feedback even when tmc-langs names a cause.
 */
export class TemplateError extends Error {
  public constructor(cause: unknown) {
    super("Failed to prepare the exercise template", { cause })
    this.name = "TemplateError"
  }
}

/** How an answer archive is compressed: a zip upload by its name or mime, else the `.tar.zst` the service packs. */
export function answerCompression(file: Pick<GradingRequestFile, "name" | "mime">): Compression {
  const isZip =
    file.name.toLowerCase().endsWith(ZIP_ARCHIVE_EXTENSION) ||
    file.mime === "application/zip" ||
    file.mime === "application/x-zip-compressed"
  return isZip ? "zip" : "zstd"
}

/**
 * Downloads an answer and its template, prepares them for a sandbox and passes the result to
 * `run`, removing the files once `run` settles.
 *
 * @throws TemplateError when the template is unusable, a `LangsError` when the answer is, and
 *   anything a download throws.
 */
export async function withPreparedSubmission<T>(
  source: SubmissionSource,
  run: (prepared: PreparedSubmission) => Promise<T>,
): Promise<T> {
  const tempPaths: string[] = []
  try {
    debug("downloading the submitted archive and the exercise template")
    const submissionArchivePath = temporaryFile()
    const templateArchivePath = temporaryFile()
    tempPaths.push(submissionArchivePath, templateArchivePath)
    // Both settle before a failure is thrown, so neither writes a temp file after its removal.
    const downloads = await Promise.allSettled([
      downloadStream(source.answer.downloadUrl, submissionArchivePath),
      downloadStream(source.templateDownloadUrl, templateArchivePath),
    ])
    for (const download of downloads) {
      if (download.status === "rejected") {
        throw download.reason
      }
    }

    debug("extracting template")
    const extractedTemplatePath = temporaryDirectory()
    tempPaths.push(extractedTemplatePath)
    try {
      await extractProject(templateArchivePath, extractedTemplatePath, log)
    } catch (e) {
      throw new TemplateError(e)
    }
    // Both settle before a failure is thrown, so neither reads the template after its removal.
    const [pointsRead, timeoutRead] = await Promise.allSettled([
      fastAvailablePoints(extractedTemplatePath, log),
      getTestsTimeoutMs(extractedTemplatePath, log),
    ])
    if (pointsRead.status === "rejected") {
      throw new TemplateError(pointsRead.reason)
    }
    if (timeoutRead.status === "rejected") {
      throw new TemplateError(timeoutRead.reason)
    }
    const points = pointsRead.value
    const testsTimeoutMs = timeoutRead.value
    const archivePath = temporaryFile()
    tempPaths.push(archivePath)
    const image = await prepareSubmission(
      extractedTemplatePath,
      archivePath,
      submissionArchivePath,
      answerCompression(source.answer),
      EXTRACT_SUBMISSION_NAIVELY,
      log,
    )
    return await run({ archivePath, image, points, testsTimeoutMs })
  } finally {
    await Promise.allSettled(tempPaths.map((p) => fs.rm(p, { recursive: true, force: true })))
  }
}
