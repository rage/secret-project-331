import { promises as fs } from "fs"
import os from "node:os"
import path from "node:path"

import { temporaryDirectory, temporaryFile } from "tempy"

import { downloadStream } from "@/lib"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"
import type { Compression, StyleValidationResult } from "@/tmc/cli"
import {
  LangsError,
  checkStyle,
  extractProject,
  fastAvailablePoints,
  prepareSubmission,
} from "@/tmc/langs"
import { badRequest, jsonOk } from "@/util/apiResponse"
import type { ExerciseTaskGradingResult, GradingProgress } from "@/util/exerciseServiceApi"
import type { GradingFeedbackExtras, GradingFeedbackKey } from "@/util/gradingFeedback"
import { createLogger } from "@/util/logger"
import { runInSandboxPod } from "@/util/podExecution"

import type { GradeRequest, GradingRequestFile } from "./requestSchemas"
import { gradeRequestSchema } from "./requestSchemas"

const { log, debug, error } = createLogger("grade")

/** What /grade answers with: grading runs in a sandbox pod for longer than a client waits on a request. */
const PENDING_RESULT: ExerciseTaskGradingResult = {
  grading_progress: "Pending",
  score_given: 0,
  score_maximum: 0,
  feedback_text: null,
  feedback_json: null,
}

const GRADING_UPDATE_ATTEMPTS = 5
const GRADING_UPDATE_RETRY_DELAY_MS = 2000

/** tmc-langs' naive submission extraction, which a project archive never needs. */
const EXTRACT_SUBMISSION_NAIVELY = false

const RUN_STATUSES = new Set([
  "PASSED",
  "TESTS_FAILED",
  "COMPILE_FAILED",
  "TESTRUN_INTERRUPTED",
  "GENERIC_ERROR",
] as const)

interface NormalizedTestResult {
  successful: boolean
  points: string[]
}
/** A tmc-langs run result reduced to what scoring needs. */
export interface NormalizedRunResult {
  status: "PASSED" | "TESTS_FAILED" | "COMPILE_FAILED" | "TESTRUN_INTERRUPTED" | "GENERIC_ERROR"
  testResults: NormalizedTestResult[]
  /** Set by tmc-langs when it stopped the tests for running too long. */
  timedOutAfterMs?: number
}

/** Normalize pod JSON: accept test_results/testResults and successful/passed. */
function normalizePodOutput(parsed: unknown): NormalizedRunResult | null {
  if (parsed === null || typeof parsed !== "object") {
    return null
  }
  const obj = parsed as Record<string, unknown>
  const rawStatus = obj["status"] ?? obj["Status"]
  const statusStr = typeof rawStatus === "string" ? rawStatus.toUpperCase() : null
  const validStatus = statusStr && (RUN_STATUSES as Set<string>).has(statusStr)
  if (!validStatus) {
    return null
  }
  const rawResults = obj["test_results"] ?? obj["testResults"]
  const rawList = Array.isArray(rawResults) ? rawResults : []
  const testResults: NormalizedTestResult[] = rawList.map((r: unknown) => {
    if (r === null || typeof r !== "object") {
      return { successful: false, points: [] }
    }
    const row = r as Record<string, unknown>
    const successful = row["successful"] === true || row["passed"] === true
    const points = Array.isArray(row["points"])
      ? (row["points"] as unknown[]).filter((p): p is string => typeof p === "string")
      : []
    return { successful, points }
  })
  const timedOutAfterMs = obj["timedOutAfterMs"]
  return {
    status: statusStr as NormalizedRunResult["status"],
    testResults,
    ...(typeof timedOutAfterMs === "number" ? { timedOutAfterMs } : {}),
  }
}

async function postImpl(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON payload")
  }
  const parsed = gradeRequestSchema.safeParse(body)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")
    return badRequest(`Invalid grading request (${issues})`)
  }
  const req = parsed.data
  const [answerArchive, ...extraFiles] = req.submission_files
  if (!answerArchive) {
    return badRequest("A submission to grade needs an archive in submission_files")
  }
  if (extraFiles.length > 0) {
    return badRequest(
      `A tmc answer is exactly one archive, got ${req.submission_files.length.toString()} files`,
    )
  }
  // The playground authorises its grading update URL itself and sends no claim header.
  const gradingUpdateClaim = request.headers.get(EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER)
  void gradeAndReport(req, answerArchive, gradingUpdateClaim)
  return jsonOk(PENDING_RESULT)
}

export const handleGrade = wrapRouteHandler(postImpl, { service: "tmc", operation: "POST /grade" })

/**
 * Gradings run at once in this process. Each holds a sandbox pod and its archives in memory, and the
 * service's own memory limit is small; the rest wait their turn, which the host's stale-grading
 * timeout bounds.
 */
const MAX_CONCURRENT_GRADINGS = 4
let runningGradings = 0
const waitingGradings: (() => void)[] = []

async function withGradingSlot<T>(grade: () => Promise<T>): Promise<T> {
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

/** Grades an answer after /grade has answered, and sends the result to the host's grading-update URL. */
async function gradeAndReport(
  req: GradeRequest,
  answerArchive: GradingRequestFile,
  gradingUpdateClaim: string | null,
): Promise<void> {
  let result: ExerciseTaskGradingResult
  try {
    result = await withGradingSlot(() => gradeAnswer(req, answerArchive))
  } catch (e) {
    error("Failed to grade", e)
    result = {
      ...PENDING_RESULT,
      grading_progress: "Failed",
      ...failedGrading(e),
    }
  }
  await sendGradingUpdate(req.grading_update_url, gradingUpdateClaim, result)
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
    file.name.toLowerCase().endsWith(".zip") ||
    file.mime === "application/zip" ||
    file.mime === "application/x-zip-compressed"
  return isZip ? "zip" : "zstd"
}

/** The cause tmc-langs gives when an answer archive holds nothing it recognises as the exercise. */
const NO_PROJECT_IN_ARCHIVE = "No project directory found in archive"

/**
 * What the student is told when grading could not run. A tmc-langs failure names a cause about the
 * answer; any other failure is the service's own, and its details, which can include signed file
 * URLs, stay in the log.
 */
export function gradingFailureFeedback(e: unknown): string {
  if (e instanceof LangsError) {
    if (e.rootCause === NO_PROJECT_IN_ARCHIVE) {
      return "The submission does not contain the exercise's files, so it could not be graded. Submit the whole exercise, including its source files."
    }
    return `The submission could not be graded: ${withoutServerPaths(e.rootCause)}`
  }
  return "The submission could not be graded because of an error on the server. Try submitting again later."
}

/** The feedback key that says which kind of failure `gradingFailureFeedback` describes. */
export function gradingFailureKey(e: unknown): GradingFeedbackKey {
  if (e instanceof LangsError) {
    return e.rootCause === NO_PROJECT_IN_ARCHIVE ? "no_project_in_archive" : "langs_error"
  }
  return "server_error"
}

/** The result fields of a grading that could not run, shared by every such outcome. */
function failedGrading(
  e: unknown,
): Pick<ExerciseTaskGradingResult, "feedback_text" | "feedback_json"> {
  const extras: GradingFeedbackExtras = {
    feedback_key: gradingFailureKey(e),
    ...(e instanceof LangsError && gradingFailureKey(e) === "langs_error"
      ? { feedback_detail: withoutServerPaths(e.rootCause) }
      : {}),
  }
  return { feedback_text: gradingFailureFeedback(e), feedback_json: extras }
}

/**
 * `cause` with each absolute path cut to what the student recognises: the part inside the
 * temporary directory the answer was extracted to, else the file name.
 */
function withoutServerPaths(cause: string): string {
  const temporaryRoot = `${os.tmpdir()}/`
  return cause.replaceAll(/(?<=^|[\s'"`(])\/[^\s'"`()]+/g, (absolutePath) => {
    if (absolutePath.startsWith(temporaryRoot)) {
      const insideAnswer = absolutePath.slice(temporaryRoot.length).split("/").slice(1).join("/")
      if (insideAnswer) {
        return insideAnswer
      }
    }
    return path.posix.basename(absolutePath)
  })
}

/**
 * Posts a grading result to the host, retrying because the host commits the pending grading only
 * after /grade has answered, so an early update can find no grading to update.
 */
async function sendGradingUpdate(
  url: string,
  gradingUpdateClaim: string | null,
  result: ExerciseTaskGradingResult,
): Promise<void> {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (gradingUpdateClaim) {
    headers[EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER] = gradingUpdateClaim
  }
  for (let attempt = 1; attempt <= GRADING_UPDATE_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(result),
      })
      if (res.ok) {
        return
      }
      error(
        `Grading update attempt ${attempt.toString()} failed: ${res.status.toString()} ${await res.text()}`,
      )
    } catch (e) {
      error(`Grading update attempt ${attempt.toString()} failed: ${String(e)}`)
    }
    if (attempt < GRADING_UPDATE_ATTEMPTS) {
      await new Promise((resolve) => {
        setTimeout(resolve, GRADING_UPDATE_RETRY_DELAY_MS * attempt)
      })
    }
  }
  error(`Gave up sending a grading update to ${url}`)
}

const gradeAnswer = async (
  req: GradeRequest,
  answerArchive: GradingRequestFile,
): Promise<ExerciseTaskGradingResult> => {
  const tempPaths: string[] = []
  try {
    const { exercise_spec } = req

    debug("downloading the submitted archive")
    const submissionArchivePath = temporaryFile()
    tempPaths.push(submissionArchivePath)
    await downloadStream(answerArchive.download_url, submissionArchivePath)

    debug("downloading exercise template")
    const templateArchivePath = temporaryFile()
    tempPaths.push(templateArchivePath)
    await downloadStream(exercise_spec.repository_exercise.download_url, templateArchivePath)

    debug("extracting template")
    const extractedTemplatePath = temporaryDirectory()
    tempPaths.push(extractedTemplatePath)
    let points: string[]
    let testsTimeoutMs: number | undefined
    try {
      await extractProject(templateArchivePath, extractedTemplatePath, log)
      points = await fastAvailablePoints(extractedTemplatePath, log)
      testsTimeoutMs = await readTestsTimeoutMs(extractedTemplatePath)
    } catch (e) {
      throw new TemplateError(e)
    }
    const preparedSubmissionArchivePath = temporaryFile()
    tempPaths.push(preparedSubmissionArchivePath)
    const sandboxImage = await prepareSubmission(
      extractedTemplatePath,
      preparedSubmissionArchivePath,
      submissionArchivePath,
      answerCompression(answerArchive),
      EXTRACT_SUBMISSION_NAIVELY,
      log,
    )

    const validations = await checkSubmissionStyle(preparedSubmissionArchivePath, tempPaths)

    log("grading in pod")
    const gradingResult = await gradeInPod(
      preparedSubmissionArchivePath,
      sandboxImage,
      points,
      testsTimeoutMs,
      validations,
    )
    log("grading finished")
    return gradingResult
  } finally {
    await Promise.allSettled(tempPaths.map((p) => fs.rm(p, { recursive: true, force: true })))
  }
}

/**
 * The exercise's `tests_timeout_ms` from its `.tmcproject.yml`, if it sets one. Reads the one
 * scalar key rather than the file, which tmc-langs parses itself when it runs the tests.
 */
export async function readTestsTimeoutMs(exerciseDir: string): Promise<number | undefined> {
  let yaml: string
  try {
    yaml = await fs.readFile(path.join(exerciseDir, ".tmcproject.yml"), "utf8")
  } catch {
    return undefined
  }
  const match = /^tests_timeout_ms:[ \t]*(\d+)[ \t]*(?:#.*)?$/m.exec(yaml)
  return match?.[1] === undefined ? undefined : Number(match[1])
}

/**
 * Style check of the prepared submission. Null when the language has none or the check could not
 * run, so a broken check never fails a student's answer.
 */
async function checkSubmissionStyle(
  preparedSubmissionArchivePath: string,
  tempPaths: string[],
): Promise<StyleValidationResult | null> {
  const projectPath = temporaryDirectory()
  tempPaths.push(projectPath)
  try {
    await extractProject(preparedSubmissionArchivePath, projectPath, log)
    return await checkStyle(projectPath, log)
  } catch (e) {
    error("Style check could not run", e)
    return null
  }
}

const gradeInPod = async (
  submissionPath: string,
  sandboxImage: string,
  points: string[],
  testsTimeoutMs: number | undefined,
  validations: StyleValidationResult | null,
): Promise<ExerciseTaskGradingResult> => {
  const logger = createLogger("grade")
  let outcome
  try {
    outcome = await runInSandboxPod(sandboxImage, submissionPath, logger, testsTimeoutMs)
  } catch (e) {
    logger.error("Failed to grade in pod", e)
    return { grading_progress: "Failed", score_given: 0, score_maximum: 0, ...failedGrading(e) }
  }

  if (outcome.timedOut) {
    return {
      grading_progress: "Failed",
      score_given: 0,
      score_maximum: 0,
      feedback_text: TIMED_OUT_FEEDBACK,
      feedback_json: { feedback_key: "timed_out" } satisfies GradingFeedbackExtras,
    }
  }

  const normalized = normalizePodOutput(outcome.parsed)
  if (!normalized) {
    throw new Error(`normalizePodOutput failed; received: ${JSON.stringify(outcome.parsed)}`)
  }

  const valgrindFailed = isValgrindFailure(normalized)
  const styleFailed = isStyleFailure(validations)
  // "Failed" is for runs that say nothing about the answer: the host does not count them as tries.
  let gradingProgress: GradingProgress = "Failed"
  let feedback: { text: string; key: GradingFeedbackKey } | null = null
  if (normalized.status === "COMPILE_FAILED") {
    gradingProgress = "FullyGraded"
    feedback = { text: "Could not compile the submission", key: "compile_failed" }
  } else if (normalized.status === "GENERIC_ERROR") {
    feedback = { text: "The tests could not be run", key: "generic_error" }
  } else if (normalized.status === "TESTRUN_INTERRUPTED") {
    feedback = { text: "Tests were interrupted", key: "interrupted" }
  } else {
    // The score already says whether the tests passed; clients show it as the result.
    gradingProgress = "FullyGraded"
    if (normalized.timedOutAfterMs !== undefined) {
      feedback = { text: TIMED_OUT_FEEDBACK, key: "timed_out" }
    } else if (valgrindFailed) {
      feedback = { text: "Valgrind found errors, so no points were given", key: "valgrind_failed" }
    } else if (styleFailed) {
      feedback = {
        text: "The code style check failed, so no points were given",
        key: "style_check_failed",
      }
    }
  }

  const extras: GradingFeedbackExtras = {
    feedback_key: feedback?.key ?? null,
    validations,
    valgrind_failed: valgrindFailed,
  }
  return {
    grading_progress: gradingProgress,
    ...runScore(normalized, points, { valgrindFailed, styleFailed }),
    feedback_text: feedback?.text ?? null,
    feedback_json: { ...(outcome.parsed as Record<string, unknown>), ...extras },
  }
}

const TIMED_OUT_FEEDBACK = "Test timed out"

/**
 * Valgrind errors make tmc-langs' make plugin fail the run without failing any test, so a failed
 * run whose tests all passed is a Valgrind failure.
 */
function isValgrindFailure(run: NormalizedRunResult): boolean {
  return (
    run.status === "TESTS_FAILED" &&
    run.timedOutAfterMs === undefined &&
    run.testResults.length > 0 &&
    run.testResults.every((tr) => tr.successful)
  )
}

function isStyleFailure(validations: StyleValidationResult | null): boolean {
  return (
    validations?.strategy === "FAIL" && Object.keys(validations.validation_errors ?? {}).length > 0
  )
}

/**
 * Points as tmc-server awards them: each available point whose tests all passed. An exercise that
 * declares no points, such as a no-tests one, is scored out of one point, because the host awards
 * nothing for 0 of 0. A failed Valgrind or style check, or a run that did not finish the tests,
 * earns nothing.
 */
export function runScore(
  run: NormalizedRunResult,
  availablePoints: string[],
  checks: { valgrindFailed?: boolean; styleFailed?: boolean } = {},
): { score_given: number; score_maximum: number } {
  const available = new Set(availablePoints)
  const scoreMaximum = Math.max(available.size, 1)
  const ranTests = run.status === "PASSED" || run.status === "TESTS_FAILED"
  if (!ranTests || checks.valgrindFailed === true || checks.styleFailed === true) {
    return { score_given: 0, score_maximum: scoreMaximum }
  }
  if (available.size === 0) {
    const allPassed =
      run.status === "PASSED" &&
      run.testResults.length > 0 &&
      run.testResults.every((tr) => tr.successful)
    return { score_given: allPassed ? 1 : 0, score_maximum: 1 }
  }
  const pointPassed = new Map<string, boolean>()
  for (const test of run.testResults) {
    for (const point of test.points) {
      pointPassed.set(point, (pointPassed.get(point) ?? true) && test.successful)
    }
  }
  const earned = [...available].filter((point) => pointPassed.get(point) === true)
  return { score_given: earned.length, score_maximum: scoreMaximum }
}
