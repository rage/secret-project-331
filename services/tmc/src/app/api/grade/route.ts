import * as k8s from "@kubernetes/client-node"
import { createReadStream, createWriteStream, promises as fs } from "fs"
import path from "path"
import internal from "stream"
import { temporaryDirectory, temporaryFile } from "tempy"
import { v4 } from "uuid"

import { ClientErrorResponse, downloadStream, initKubeApi, initKubeConfig } from "@/lib"
import { ExerciseTaskGradingResult, GradingProgress } from "@/shared-module/common/bindings"
import { GradingRequest } from "@/shared-module/common/exercise-service-protocol-types-2"
import { isNonGenericGradingRequest } from "@/shared-module/common/exercise-service-protocol-types.guard"
import { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER } from "@/shared-module/common/utils/exerciseServices"
import {
  compressProject,
  extractProject,
  fastAvailablePoints,
  prepareSubmission,
} from "@/tmc/langs"
import { PrivateSpec, UserAnswer } from "@/util/stateInterfaces"

const DEFAULT_TASK_TIMEOUT_MS = 60000

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

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json()

    if (!isNonGenericGradingRequest(body)) {
      throw new Error("Invalid grading request")
    }

    const specRequest = body as TmcGradingRequest
    let gradingUpdateClaim: string | null = null
    const gradingUpdateClaimHeader = request.headers.get(
      EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER,
    )
    if (typeof gradingUpdateClaimHeader === "string") {
      gradingUpdateClaim = gradingUpdateClaimHeader
    }

    return await processGrading(specRequest, gradingUpdateClaim)
  } catch (err) {
    return internalServerError("Error while processing request", err)
  }
}

type TmcGradingRequest = GradingRequest<PrivateSpec, UserAnswer>

/** Unwrap submission_data if the frontend sent { private_spec: UserAnswer } (current-state payload). */
function normalizeSubmissionData(raw: unknown): UserAnswer | null {
  if (raw && typeof raw === "object" && "type" in raw) {
    const t = (raw as UserAnswer).type
    if (t === "browser" || t === "editor") {
      return raw as UserAnswer
    }
  }
  if (raw && typeof raw === "object" && "private_spec" in raw) {
    const inner = (raw as { private_spec: unknown }).private_spec
    if (inner && typeof inner === "object" && "type" in inner) {
      const t = (inner as UserAnswer).type
      if (t === "browser" || t === "editor") {
        return inner as UserAnswer
      }
    }
  }
  return null
}

const processGrading = async (
  req: TmcGradingRequest,
  _gradingUpdateClaim: string | null,
): Promise<Response> => {
  try {
    const { exercise_spec } = req
    const rawSubmissionData = req.submission_data as unknown
    const submission_data = normalizeSubmissionData(rawSubmissionData)
    if (!submission_data) {
      return badRequest(
        `unexpected submission type '${exercise_spec.type}' (missing or invalid submission_data)`,
      )
    }

    debug("prepare submission for the grading pod")
    const submissionArchivePath = temporaryFile()
    let extractSubmissionNaively: boolean
    if (exercise_spec.type === "editor" && submission_data.type === "editor") {
      debug("grading editor submission")
      const archiveDownloadUrl = submission_data.archive_download_url
      await downloadStream(archiveDownloadUrl, submissionArchivePath)
      extractSubmissionNaively = false
      // todo: support other compression methods? for now we just assume .tar.zstd
    } else if (exercise_spec.type === "browser" && submission_data.type === "browser") {
      debug("grading browser submission")
      const submissionDir = temporaryDirectory()
      for (const { filepath, contents } of submission_data.files) {
        const resolved = path.resolve(submissionDir, filepath)
        debug("making", path.dirname(resolved))
        await fs.mkdir(path.dirname(resolved), { recursive: true })
        debug("writing", resolved)
        await fs.writeFile(resolved, contents)
      }
      debug("compressing project")
      await compressProject(submissionDir, submissionArchivePath, "zstd", true, log)
      // Use same preparation as editor/Test so student files overwrite clone at root;
      // with true, submission is under a UUID dir and pod runs from /app so tests run template code.
      extractSubmissionNaively = false
    } else {
      return badRequest(`unexpected submission type '${exercise_spec.type}'`)
    }

    debug("downloading exercise template")
    const templateArchivePath = temporaryFile()
    await downloadStream(exercise_spec.repository_exercise.download_url, templateArchivePath)

    debug("extracting template")
    const extractedTemplatePath = temporaryDirectory()
    await extractProject(templateArchivePath, extractedTemplatePath, log)
    const points = await fastAvailablePoints(extractedTemplatePath, log)
    // prepare submission with tmc-langs
    const preparedSubmissionArchivePath = temporaryFile()
    const sandboxImage = await prepareSubmission(
      extractedTemplatePath,
      preparedSubmissionArchivePath,
      submissionArchivePath,
      "zstd",
      extractSubmissionNaively,
      log,
    )

    log("grading in pod")
    log("waiting for the grading to finish")
    const gradingResult = await gradeInPod(preparedSubmissionArchivePath, sandboxImage, points)
    log("grading finished, returning result")
    return ok(gradingResult)
  } catch (e) {
    return internalServerError("Error while processing grading", e)
  }
}

const gradeInPod = async (
  submissionPath: string,
  sandboxImage: string,
  points: Array<string>,
): Promise<ExerciseTaskGradingResult> => {
  const kubeConfig = initKubeConfig()
  const kubeApi = initKubeApi()

  const pod = new k8s.V1Pod()

  // set pod.metadata
  const podId = v4()
  const podName = `tmc-sandbox-pod-${podId}`
  pod.metadata = new k8s.V1ObjectMeta()
  pod.metadata.name = podName

  // set pod.spec
  const container = new k8s.V1Container()
  const containerName = "tmc-submission-execution-sandbox"
  container.name = containerName
  container.image = sandboxImage
  // the container sleeps for the task timeout + 10 minutes to
  // ensure the container doesn't stay up for too long if something goes wrong
  container.command = ["sleep", (DEFAULT_TASK_TIMEOUT_MS + 10 * 60 * 1000).toString()]

  let gradingResult: ExerciseTaskGradingResult
  try {
    gradingResult = await gradeInPodInner(
      kubeApi,
      kubeConfig,
      pod,
      podName,
      container,
      containerName,
      sandboxImage,
      submissionPath,
      points,
    )
  } catch (e) {
    console.error(`Failed to grade in pod: ${e}`)
    gradingResult = {
      grading_progress: "Failed",
      score_given: 0,
      score_maximum: 0,
      feedback_text: `Something went wrong: ${e}`,
      feedback_json: null,
    }
  }

  // delete the pod now that we're done
  log(`deleting pod ${podName}`)
  try {
    await kubeApi.deleteNamespacedPod({ name: podName, namespace: "default", pretty: "true" })
  } catch (_e) {
    error("failed to delete pod")
  }

  return gradingResult
}

const gradeInPodInner = async (
  kubeApi: k8s.CoreV1Api,
  kubeConfig: k8s.KubeConfig,
  pod: k8s.V1Pod,
  podName: string,
  container: k8s.V1Container,
  containerName: string,
  sandboxImage: string,
  submissionPath: string,
  points: Array<string>,
): Promise<ExerciseTaskGradingResult> => {
  pod.spec = new k8s.V1PodSpec()
  pod.spec.containers = [container]

  // start pod and wait for it to start
  log("starting sandbox image", sandboxImage)
  await kubeApi.createNamespacedPod({ namespace: "default", body: pod, pretty: "true" })
  let podPhase = null
  while (podPhase !== "Running") {
    // poll once per 500 ms
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    await delay(500)

    const podStatus = await kubeApi.readNamespacedPodStatus({
      namespace: "default",
      name: podName,
      pretty: "true",
    })
    podPhase = podStatus.status?.phase
    if (podPhase !== "Pending" && podPhase !== "Running") {
      // may indicate a problem like the pod crashing
      throw new Error(`Unexpected phase ${podPhase}`)
    }
  }

  // copy and extract exercise to pod /app/
  const kubeExec = new k8s.Exec(kubeConfig)
  const submissionReadStream = createReadStream(submissionPath)
  const tarResult = await execWithTimeout(
    kubeExec,
    podName,
    containerName,
    [
      "tar",
      "--verbose",
      "--use-compress-program",
      "zstd",
      "--extract",
      "--file",
      "-",
      "--directory",
      "/app/",
    ],
    process.stdout,
    process.stderr,
    submissionReadStream,
    DEFAULT_TASK_TIMEOUT_MS, // could use a different/shorter timeout here
  )
  if (tarResult.timedOut) {
    throw new Error("Running tar inside the container timed out")
  }

  // run tests, the image should have a /tmc-run script
  const tmcRunResult = await execWithTimeout(
    kubeExec,
    podName,
    containerName,
    ["/tmc-run"],
    process.stdout,
    process.stderr,
    null,
    DEFAULT_TASK_TIMEOUT_MS,
  )
  if (tmcRunResult.timedOut) {
    log("tmc-run timed out")
    return {
      grading_progress: "Failed",
      score_given: 0,
      score_maximum: 0,
      feedback_text: "Test timed out",
      feedback_json: null,
    }
  } else {
    log("tmc-run finished")
  }

  // read test results, the container should now have an /app/test_output.txt file
  /*
  cpFromPod is broken: https://github.com/kubernetes-client/javascript/issues/982
  while waiting for a fix, we do the copy via `cat`
  const kubeCp = new k8s.Cp(kubeConfig)
  const f = await kubeCp.cpFromPod(
    "default",
    podName,
    containerName,
    "/app/test_output.txt",
    testOutputPath,
  )
  */
  const testOutputPath = temporaryFile()
  const testOutputWriteStream = createWriteStream(testOutputPath)
  const catResult = await execWithTimeout(
    kubeExec,
    podName,
    containerName,
    ["cat", "/app/test_output.txt"],
    testOutputWriteStream,
    process.stderr,
    null,
    DEFAULT_TASK_TIMEOUT_MS, // could use a different/shorter timeout here
  )
  if (catResult.timedOut) {
    throw new Error("Running cat inside the container timed out")
  }
  const testOutputBuffer = await fs.readFile(testOutputPath)
  const testOutputString = testOutputBuffer.toString()
  log(`got output ${testOutputString} end`)
  const testOutput = JSON.parse(testOutputString)
  const normalized = normalizePodOutput(testOutput)
  if (!normalized) {
    throw new Error("Unexpected results")
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
    feedback_json: testOutput,
  }
}

// convenience function for executing stuff inside a container
const execWithTimeout = async (
  kubeExec: k8s.Exec,
  podName: string,
  containerName: string,
  command: Array<string>,
  stdout: internal.Writable,
  stderr: internal.Writable,
  stdin: internal.Readable | null,
  timeoutMs: number,
): Promise<{ timedOut: boolean }> => {
  const execSocket = await kubeExec.exec(
    "default",
    podName,
    containerName,
    command,
    stdout,
    stderr,
    stdin,
    false,
  )
  const execPromise = new Promise<{ timedOut: boolean }>((resolve) => {
    execSocket.onclose = () => resolve({ timedOut: false })
  })
  const timeoutPromise = new Promise<{ timedOut: boolean }>((resolve) => {
    setTimeout(() => {
      resolve({ timedOut: true })
    }, timeoutMs)
  })
  return await Promise.race([execPromise, timeoutPromise])
}

// response helpers

const ok = (modelSolutionSpec: ExerciseTaskGradingResult): Response => {
  return Response.json(modelSolutionSpec, { status: 200 })
}

const badRequest = (contextMessage: string, error?: unknown): Response => {
  return errorResponse(400, contextMessage, error)
}

const internalServerError = (contextMessage: string, err?: unknown): Response => {
  return errorResponse(500, contextMessage, err)
}

const errorResponse = (statusCode: number, contextMessage: string, err?: unknown): Response => {
  let message
  let stack = undefined
  if (err instanceof Error) {
    message = `${contextMessage}: ${err.message}`
    stack = err.stack
  } else if (typeof err === "string") {
    message = `${contextMessage}: ${err}`
  } else if (err === undefined) {
    message = contextMessage
  } else {
    // unexpected type
    message = `${contextMessage}: ${JSON.stringify(err, undefined, 2)}`
  }
  error(message, stack)
  const body: ClientErrorResponse = { message }
  return Response.json(body, { status: statusCode })
}

// logging helpers

const log = (message: string, ...optionalParams: unknown[]): void => {
  console.log(`[grade]`, message, ...optionalParams)
}

const debug = (message: string, ...optionalParams: unknown[]): void => {
  console.debug(`[grade]`, message, ...optionalParams)
}

const error = (message: string, ...optionalParams: unknown[]): void => {
  console.error(`[grade]`, message, ...optionalParams)
}
