import { promises as fs } from "fs"
import path from "path"
import { temporaryDirectory, temporaryFile } from "tempy"

import {
  GradeRequest,
  gradeRequestSchema,
  userAnswerSchema,
  wrappedUserAnswerSchema,
} from "./requestSchemas"

import { downloadStream } from "@/lib"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import {
  compressProject,
  extractProject,
  fastAvailablePoints,
  prepareSubmission,
} from "@/tmc/langs"
import { badRequest, jsonOk } from "@/util/apiResponse"
import { ExerciseTaskGradingResult, GradingProgress } from "@/util/exerciseServiceApi"
import { createLogger } from "@/util/logger"
import { runInSandboxPod } from "@/util/podExecution"
import { UserAnswer } from "@/util/stateInterfaces"

const { log, debug } = createLogger("grade")

const RUN_STATUSES = new Set([
  "PASSED",
  "TESTS_FAILED",
  "COMPILE_FAILED",
  "TESTRUN_INTERRUPTED",
  "GENERIC_ERROR",
] as const)

type NormalizedTestResult = { successful: boolean; points: string[] }
type NormalizedRunResult = {
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
    return badRequest("Invalid grading request")
  }
  return await processGrading(parsed.data)
}

export const handleGrade = wrapRouteHandler(postImpl, { service: "tmc", operation: "POST /grade" })

/** Unwrap submission_data if the frontend sent { private_spec: UserAnswer } (current-state payload). */
function normalizeSubmissionData(raw: unknown): UserAnswer | null {
  const direct = userAnswerSchema.safeParse(raw)
  if (direct.success) {
    return direct.data
  }
  const wrapped = wrappedUserAnswerSchema.safeParse(raw)
  if (wrapped.success) {
    return wrapped.data.private_spec
  }
  return null
}

const processGrading = async (req: GradeRequest): Promise<Response> => {
  const tempPaths: string[] = []
  try {
    const { exercise_spec } = req
    const submission_data = normalizeSubmissionData(req.submission_data)
    if (!submission_data) {
      return badRequest(
        `unexpected submission type '${exercise_spec.type}' (missing or invalid submission_data)`,
      )
    }

    debug("prepare submission for the grading pod")
    const submissionArchivePath = temporaryFile()
    tempPaths.push(submissionArchivePath)
    let extractSubmissionNaively: boolean
    if (exercise_spec.type === "editor" && submission_data.type === "editor") {
      debug("grading editor submission")
      const archiveDownloadUrl = submission_data.archive_download_url
      await downloadStream(archiveDownloadUrl, submissionArchivePath)
      extractSubmissionNaively = false
    } else if (exercise_spec.type === "browser" && submission_data.type === "browser") {
      debug("grading browser submission")
      const submissionDir = temporaryDirectory()
      tempPaths.push(submissionDir)
      for (const { filepath, contents } of submission_data.files) {
        const resolved = path.resolve(submissionDir, filepath)
        debug("making", path.dirname(resolved))
        await fs.mkdir(path.dirname(resolved), { recursive: true })
        debug("writing", resolved)
        await fs.writeFile(resolved, contents)
      }
      debug("compressing project")
      await compressProject(submissionDir, submissionArchivePath, "zstd", true, log)
      extractSubmissionNaively = false
    } else {
      return badRequest(`unexpected submission type '${exercise_spec.type}'`)
    }

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
      extractSubmissionNaively,
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
  points: Array<string>,
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
