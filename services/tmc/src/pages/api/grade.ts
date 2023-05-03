/* eslint-disable i18next/no-literal-string */
import * as k8s from "@kubernetes/client-node"
import axios from "axios"
import { createReadStream, createWriteStream, promises as fs } from "fs"
import { NextApiRequest, NextApiResponse } from "next"
import path from "path"
import internal from "stream"
import { temporaryDirectory, temporaryFile } from "tempy"
import { v4 } from "uuid"

import { ClientErrorResponse, downloadStream, initKubeApi, initKubeConfig } from "../../lib"
import { ExerciseTaskGradingResult, GradingProgress } from "../../shared-module/bindings"
import { GradingRequest } from "../../shared-module/exercise-service-protocol-types-2"
import { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER } from "../../shared-module/utils/exerciseServices"
import { isRunResult } from "../../tmc/cli.guard"
import {
  compressProject,
  extractProject,
  fastAvailablePoints,
  prepareSubmission,
} from "../../tmc/langs"
import { PrivateSpec, UserAnswer } from "../../util/stateInterfaces"

const DEFAULT_TASK_TIMEOUT_MS = 60000

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ExerciseTaskGradingResult | ClientErrorResponse>,
): Promise<void> => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  let gradingUpdateClaim: string | null = null
  const gradingUpdateClaimHeader = req.headers[EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER]
  if (typeof gradingUpdateClaimHeader === "string") {
    gradingUpdateClaim = gradingUpdateClaimHeader
  }

  let postResult: PostResult
  try {
    postResult = await handlePost(req, res)
  } catch (e) {
    console.error(JSON.stringify(e, null, 2))
    let message = "Internal server error"
    // check for langs error
    if (typeof e === "object" && e && "message" in e) {
      message += `: ${e.message}`
    } else if (e instanceof Error) {
      message += `: ${e.message}`
    } else {
      message += `: ${JSON.stringify(e)}`
    }
    return res.status(500).send({ message })
  }

  // wait for the grading to finish and send the finished grading
  const gradingResult = await postResult.gradingPromise
  console.log(`sending grading to ${postResult.gradingUpdateUrl}`)
  await axios.post(postResult.gradingUpdateUrl, gradingResult, {
    headers: gradingUpdateClaim
      ? { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER: gradingUpdateClaim }
      : {},
  })
}

type TmcGradingRequest = GradingRequest<PrivateSpec, UserAnswer>

interface PostResult {
  gradingPromise: Promise<ExerciseTaskGradingResult>
  gradingUpdateUrl: string
}

const handlePost = async (
  req: NextApiRequest,
  res: NextApiResponse<ExerciseTaskGradingResult | ClientErrorResponse>,
): Promise<PostResult> => {
  const { exercise_spec, submission_data, grading_update_url } = req.body as TmcGradingRequest

  // prepare submission for the grading pod
  const submissionArchivePath = temporaryFile()
  let extractSubmissionNaively: boolean
  if (exercise_spec.type === "editor" && submission_data.type === "editor") {
    // download submission
    const archiveDownloadUrl = submission_data.archiveDownloadUrl
    await downloadStream(archiveDownloadUrl, submissionArchivePath)
    extractSubmissionNaively = false
    // todo: support other compression methods? for now we just assume .tar.zstd
  } else if (exercise_spec.type === "browser" && submission_data.type === "browser") {
    // write submission files
    const submissionDir = temporaryDirectory()
    for (const { filepath, contents } of submission_data.files) {
      const resolved = path.resolve(submissionDir, filepath)
      console.log("making", path.dirname(resolved))
      await fs.mkdir(path.dirname(resolved), { recursive: true })
      console.log("writing", resolved)
      await fs.writeFile(resolved, contents)
    }
    await compressProject(submissionDir, submissionArchivePath, "zstd", true)
    extractSubmissionNaively = true
  } else {
    console.error("unexpected submission type", exercise_spec, submission_data)
    throw "unexpected submission type"
  }

  // download exercise template
  const templateArchivePath = temporaryFile()
  await downloadStream(exercise_spec.repositoryExercise.download_url, templateArchivePath)

  // extract template
  const extractedTemplatePath = temporaryDirectory()
  await extractProject(templateArchivePath, extractedTemplatePath)
  const points = await fastAvailablePoints(extractedTemplatePath)
  // prepare submission with tmc-langs
  const preparedSubmissionArchivePath = temporaryFile()
  const sandboxImage = await prepareSubmission(
    extractedTemplatePath,
    preparedSubmissionArchivePath,
    submissionArchivePath,
    "zstd",
    extractSubmissionNaively,
  )
  console.log("prepared submission")

  const pendingSubmission = gradeInPod(preparedSubmissionArchivePath, sandboxImage, points)

  // let the server know the grading request has been received
  res.status(200).json({
    grading_progress: "Pending",
    score_given: 0,
    score_maximum: 0,
    feedback_text: null,
    feedback_json: null,
  })

  return { gradingPromise: pendingSubmission, gradingUpdateUrl: grading_update_url }
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
  console.log(`deleting pod ${podName}`)
  try {
    await kubeApi.deleteNamespacedPod(podName, "default", "true")
  } catch (e) {
    console.error("Failed to delete pod")
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
  console.log("starting sandbox image", sandboxImage)
  await kubeApi.createNamespacedPod("default", pod, "true")
  let podPhase = null
  while (podPhase !== "Running") {
    // poll once per 500 ms
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    await delay(500)

    const podStatus = await kubeApi.readNamespacedPodStatus(podName, "default")
    podPhase = podStatus.body.status?.phase
    if (podPhase !== "Pending" && podPhase !== "Running") {
      // may indicate a problem like the pod crashing
      throw `Unexpected phase ${podPhase}`
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
    throw "Running tar inside the container timed out"
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
    console.log("tmc-run timed out")
    return {
      grading_progress: "Failed",
      score_given: 0,
      score_maximum: 0,
      feedback_text: "Test timed out",
      feedback_json: null,
    }
  } else {
    console.log("tmc-run finished")
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
    throw "Running cat inside the container timed out"
  }
  const testOutputBuffer = await fs.readFile(testOutputPath)
  const testOutputString = testOutputBuffer.toString()
  console.log(`got output ${testOutputString} end`)
  const testOutput = JSON.parse(testOutputString)

  if (isRunResult(testOutput)) {
    let gradingProgress: GradingProgress = "Failed"
    let feedbackText: string | null = null
    if (testOutput.status === "COMPILE_FAILED") {
      feedbackText = "Could not compile the submission"
    } else if (testOutput.status === "GENERIC_ERROR") {
      feedbackText = "Something went wrong"
    } else if (testOutput.status === "TESTRUN_INTERRUPTED") {
      feedbackText = "Tests were interrupted"
    } else if (testOutput.status === "PASSED") {
      gradingProgress = "FullyGraded"
      feedbackText = "Tests passed"
    } else if (testOutput.status === "TESTS_FAILED") {
      gradingProgress = "FullyGraded"
      feedbackText = "Tests failed"
    }
    return {
      grading_progress: gradingProgress,
      score_given: testOutput.testResults.flatMap((tr) => tr.points).length,
      score_maximum: points.length,
      feedback_text: feedbackText,
      feedback_json: testOutput,
    }
  } else {
    throw "Unexpected results"
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
