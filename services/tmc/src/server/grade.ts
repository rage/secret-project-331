import { promises as fs } from "fs"

import { temporaryDirectory, temporaryFile } from "tempy"

import { downloadStream } from "@/lib"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { extractProject, fastAvailablePoints, prepareSubmission } from "@/tmc/langs"
import { badRequest, jsonOk } from "@/util/apiResponse"
import type { ExerciseTaskGradingResult, GradingProgress } from "@/util/exerciseServiceApi"
import { createLogger } from "@/util/logger"
import { runInSandboxPod } from "@/util/podExecution"

import type { GradeRequest } from "./requestSchemas"
import { gradeRequestSchema } from "./requestSchemas"

const { log, debug } = createLogger("grade")

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
  return await processGrading(parsed.data)
}

export const handleGrade = wrapRouteHandler(postImpl, { service: "tmc", operation: "POST /grade" })

const processGrading = async (req: GradeRequest): Promise<Response> => {
  const tempPaths: string[] = []
  try {
    const { exercise_spec, submission_files } = req
    const [answerArchive, ...extraFiles] = submission_files
    if (!answerArchive) {
      return badRequest("A submission to grade needs an archive in submission_files")
    }
    if (extraFiles.length > 0) {
      return badRequest(
        `A tmc answer is exactly one archive, got ${submission_files.length.toString()} files`,
      )
    }

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
    log("grading finished, returning result")
    return jsonOk(gradingResult)
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
