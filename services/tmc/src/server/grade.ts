import os from "node:os"
import path from "node:path"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"
import { LangsError } from "@/tmc/langs"
import { badRequest, jsonOk } from "@/util/apiResponse"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import type { GradingFeedbackExtras, GradingFeedbackKey } from "@/util/gradingFeedback"
import { createLogger } from "@/util/logger"
import { runInSandboxPod } from "@/util/podExecution"

import { gradingResultFromRun, SERVER_ERROR_FEEDBACK } from "./gradingResult"
import { HOST_GIVES_UP_AFTER_MS, sendGradingUpdate } from "./gradingUpdate"
import type { SubmissionSource } from "./preparedSubmission"
import { withGradingSlot, withPreparedSubmission } from "./preparedSubmission"
import { gradingSandboxMode } from "./remoteSandbox/config"
import { remoteGradings, sandboxSubmission } from "./remoteSandbox/remoteGradings"
import type { GradeRequest, GradingRequestFile } from "./requestSchemas"
import { currentRepositoryExercise, gradeRequestSchema } from "./requestSchemas"

const { log, error } = createLogger("grade")

/** What /grade answers with: grading runs in a sandbox for longer than a client waits on a request. */
const PENDING_RESULT: ExerciseTaskGradingResult = {
  grading_progress: "Pending",
  score_given: 0,
  score_maximum: 0,
  feedback_text: null,
  feedback_json: null,
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
 * Grades an answer after /grade has answered, and sends the result to the host's grading-update
 * URL. A remote sandbox's result arrives later through `/api/sandbox-results` instead.
 */
async function gradeAndReport(
  req: GradeRequest,
  answerArchive: GradingRequestFile,
  gradingUpdateClaim: string | null,
): Promise<void> {
  const queuedAt = Date.now()
  let result: ExerciseTaskGradingResult | null
  try {
    result = await withGradingSlot(() => {
      if (Date.now() - queuedAt >= HOST_GIVES_UP_AFTER_MS) {
        log("Skipped a grading that waited longer than the host waits for its result")
        return Promise.resolve(null)
      }
      return gradeAnswer(req, answerArchive, gradingUpdateClaim)
    })
  } catch (e) {
    error("Failed to grade", e)
    result = {
      ...PENDING_RESULT,
      grading_progress: "Failed",
      ...failedGrading(e),
    }
  }
  if (result !== null) {
    await sendGradingUpdate(req.grading_update_url, gradingUpdateClaim, result)
  }
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
  return SERVER_ERROR_FEEDBACK
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
  const feedbackKey = gradingFailureKey(e)
  const extras: GradingFeedbackExtras = {
    feedback_key: feedbackKey,
    ...(e instanceof LangsError && feedbackKey === "langs_error"
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

/** The grading, or null when a remote sandbox took the answer and will call back with the result. */
const gradeAnswer = (
  req: GradeRequest,
  answerArchive: GradingRequestFile,
  gradingUpdateClaim: string | null,
): Promise<ExerciseTaskGradingResult | null> => {
  const submission: SubmissionSource = {
    answer: {
      name: answerArchive.name,
      mime: answerArchive.mime,
      downloadUrl: answerArchive.download_url,
    },
    templateDownloadUrl: currentRepositoryExercise(req, req.exercise_spec).download_url,
  }
  return withPreparedSubmission(submission, async (prepared) => {
    if (gradingSandboxMode() === "remote") {
      log("sending to a remote sandbox")
      await remoteGradings().start(
        { submission, gradingUpdateUrl: req.grading_update_url, gradingUpdateClaim },
        await sandboxSubmission(prepared),
      )
      return null
    }
    log("grading in pod")
    const gradingResult = await gradeInPod(
      prepared.archivePath,
      prepared.image,
      prepared.points,
      prepared.testsTimeoutMs,
    )
    log("grading finished")
    return gradingResult
  })
}

const gradeInPod = async (
  submissionPath: string,
  sandboxImage: string,
  points: string[],
  testsTimeoutMs: number,
): Promise<ExerciseTaskGradingResult> => {
  const logger = createLogger("grade")
  let outcome
  try {
    outcome = await runInSandboxPod(sandboxImage, submissionPath, logger, testsTimeoutMs)
  } catch (e) {
    logger.error("Failed to grade in pod", e)
    return { grading_progress: "Failed", score_given: 0, score_maximum: 0, ...failedGrading(e) }
  }

  return gradingResultFromRun(outcome, points)
}
