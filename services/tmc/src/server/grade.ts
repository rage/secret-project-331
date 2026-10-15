import { promises as fs } from "fs"

import { temporaryDirectory, temporaryFile } from "tempy"

import { downloadStream } from "@/lib"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"
import { extractProject, fastAvailablePoints, prepareSubmission } from "@/tmc/langs"
import { badRequest, jsonOk } from "@/util/apiResponse"
import type { ExerciseTaskGradingResult, GradingProgress } from "@/util/exerciseServiceApi"
import { createLogger } from "@/util/logger"
import { runInSandboxPod } from "@/util/podExecution"

import type { GradeRequest } from "./requestSchemas"
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
interface NormalizedRunResult {
  status: "PASSED" | "TESTS_FAILED" | "COMPILE_FAILED" | "TESTRUN_INTERRUPTED" | "GENERIC_ERROR"
  testResults: NormalizedTestResult[]
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
  return {
    status: statusStr as NormalizedRunResult["status"],
    testResults,
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
  void gradeAndReport(req, answerArchive.download_url, gradingUpdateClaim)
  return jsonOk(PENDING_RESULT)
}

export const handleGrade = wrapRouteHandler(postImpl, { service: "tmc", operation: "POST /grade" })

/** Grades an answer after /grade has answered, and sends the result to the host's grading-update URL. */
async function gradeAndReport(
  req: GradeRequest,
  answerArchiveUrl: string,
  gradingUpdateClaim: string | null,
): Promise<void> {
  let result: ExerciseTaskGradingResult
  try {
    result = await gradeAnswer(req, answerArchiveUrl)
  } catch (e) {
    error(`Failed to grade: ${String(e)}`)
    result = {
      ...PENDING_RESULT,
      grading_progress: "Failed",
      feedback_text: `Something went wrong: ${String(e)}`,
    }
  }
  await sendGradingUpdate(req.grading_update_url, gradingUpdateClaim, result)
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
  answerArchiveUrl: string,
): Promise<ExerciseTaskGradingResult> => {
  const tempPaths: string[] = []
  try {
    const { exercise_spec } = req

    debug("downloading the submitted archive")
    const submissionArchivePath = temporaryFile()
    tempPaths.push(submissionArchivePath)
    await downloadStream(answerArchiveUrl, submissionArchivePath)

    debug("downloading exercise template")
    const templateArchivePath = temporaryFile()
    tempPaths.push(templateArchivePath)
    await downloadStream(exercise_spec.repository_exercise.download_url, templateArchivePath)

    debug("extracting template")
    const extractedTemplatePath = temporaryDirectory()
    tempPaths.push(extractedTemplatePath)
    await extractProject(templateArchivePath, extractedTemplatePath, log)
    const points = await fastAvailablePoints(extractedTemplatePath, log)
    const preparedSubmissionArchivePath = temporaryFile()
    tempPaths.push(preparedSubmissionArchivePath)
    const sandboxImage = await prepareSubmission(
      extractedTemplatePath,
      preparedSubmissionArchivePath,
      submissionArchivePath,
      "zstd",
      EXTRACT_SUBMISSION_NAIVELY,
      log,
    )

    log("grading in pod")
    const gradingResult = await gradeInPod(preparedSubmissionArchivePath, sandboxImage, points)
    log("grading finished")
    return gradingResult
  } finally {
    await Promise.allSettled(tempPaths.map((p) => fs.rm(p, { recursive: true, force: true })))
  }
}

const gradeInPod = async (
  submissionPath: string,
  sandboxImage: string,
  points: string[],
): Promise<ExerciseTaskGradingResult> => {
  const logger = createLogger("grade")
  let outcome
  try {
    outcome = await runInSandboxPod(sandboxImage, submissionPath, logger)
  } catch (e) {
    logger.error(`Failed to grade in pod: ${e}`)
    return {
      grading_progress: "Failed",
      score_given: 0,
      score_maximum: 0,
      feedback_text: `Something went wrong: ${e}`,
      feedback_json: null,
    }
  }

  if (outcome.timedOut) {
    return {
      grading_progress: "Failed",
      score_given: 0,
      score_maximum: 0,
      feedback_text: "Test timed out",
      feedback_json: null,
    }
  }

  const normalized = normalizePodOutput(outcome.parsed)
  if (!normalized) {
    throw new Error(`normalizePodOutput failed; received: ${JSON.stringify(outcome.parsed)}`)
  }

  let gradingProgress: GradingProgress = "Failed"
  let feedbackText: string | null = null
  if (normalized.status === "COMPILE_FAILED") {
    feedbackText = "Could not compile the submission"
  } else if (normalized.status === "GENERIC_ERROR") {
    feedbackText = "Something went wrong"
  } else if (normalized.status === "TESTRUN_INTERRUPTED") {
    feedbackText = "Tests were interrupted"
  } else if (normalized.status === "PASSED") {
    gradingProgress = "FullyGraded"
    feedbackText = "Tests passed"
  } else if (normalized.status === "TESTS_FAILED") {
    gradingProgress = "FullyGraded"
    feedbackText = "Tests failed"
  }

  const allPassed =
    normalized.status === "PASSED" &&
    normalized.testResults.length > 0 &&
    normalized.testResults.every((tr) => tr.successful)
  const score_given = allPassed ? points.length : 0

  return {
    grading_progress: gradingProgress,
    score_given,
    score_maximum: points.length,
    feedback_text: feedbackText,
    feedback_json: outcome.parsed,
  }
}
