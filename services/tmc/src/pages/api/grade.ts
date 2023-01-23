/* eslint-disable i18next/no-literal-string */
import * as k8s from "@kubernetes/client-node"
import axios from "axios"
import { createReadStream, promises as fs } from "fs"
import { NextApiRequest, NextApiResponse } from "next"
import path from "path"
import { temporaryDirectory, temporaryFile } from "tempy"
import { v4 } from "uuid"
import WebSocket from "ws"

import {
  ClientErrorResponse,
  downloadStream,
  GradingResult,
  initKubeApi,
  initKubeConfig,
  pendingSubmissions,
} from "../../lib"
import { GradingProgress } from "../../shared-module/bindings"
import { GradingRequest } from "../../shared-module/exercise-service-protocol-types-2"
import { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER } from "../../shared-module/utils/exerciseServices"
import { isRunResult } from "../../tmc/cli.guard"
import {
  compressProject,
  extractProject,
  fastAvailablePoints,
  prepareSubmission,
} from "../../tmc/langs"
import { PrivateSpec, Submission } from "../../util/stateInterfaces"

const DEFAULT_TASK_TIMEOUT_MS = 60000

export default async (
  req: NextApiRequest,
  res: NextApiResponse<GradingResult | ClientErrorResponse>,
): Promise<void> => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  let gradingUpdateClaim: string | null = null
  const gradingUpdateClaimHeader = req.headers[EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER]
  if (typeof gradingUpdateClaimHeader === "string") {
    gradingUpdateClaim = gradingUpdateClaimHeader
  }
  if (gradingUpdateClaim === null) {
    return res
      .status(400)
      .send({ message: `Missing '${EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER}' header` })
  }

  try {
    return await handlePost(req, gradingUpdateClaim, res)
  } catch (e) {
    console.log(e)
    return res.status(500).send({ message: "Internal server error" })
  }
}

type TmcGradingRequest = GradingRequest<PrivateSpec, Submission>

const handlePost = async (
  req: NextApiRequest,
  gradingUpdateClaim: string,
  res: NextApiResponse<GradingResult | ClientErrorResponse>,
): Promise<void> => {
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
    for (const [relativePath, contents] of submission_data.files) {
      const submissionFilePath = `${submissionDir}/${relativePath}`
      console.log("making", path.dirname(submissionFilePath))
      await fs.mkdir(path.dirname(submissionFilePath), { recursive: true })
      console.log("writing", submissionFilePath)
      await fs.writeFile(submissionFilePath, contents)
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

  const gradingId = v4()
  const pendingSubmission = gradeInPod(preparedSubmissionArchivePath, sandboxImage, points)

  // store pending
  pendingSubmissions.push({
    id: gradingId,
    gradingResultUrl: "todo",
    timestamp: Date.now(),
  })

  // let the server know the grading request has been received
  res.status(200).json({
    grading_progress: "Pending",
    score_given: 0,
    score_maximum: 0,
    feedback_text: null,
    feedback_json: null,
  })

  // wait for the grading to finish and send the finished grading
  const gradingResult = await pendingSubmission
  await axios.post(grading_update_url, gradingResult, {
    headers: { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER: gradingUpdateClaim },
  })
}

const gradeInPod = async (
  submissionPath: string,
  sandboxImage: string,
  points: Array<string>,
): Promise<GradingResult> => {
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

  let gradingResult: GradingResult
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
    console.error("Failed to grade in pod")
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
): Promise<GradingResult> => {
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
  await kubeExec.exec(
    "default",
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
    // tty = false, the piping does not work otherwise
    false,
  )

  // `as`: workaround due to typescript being unable to understand that timeoutStatusCode is (potentially) set to a non-null value in a callback
  let timeoutStatusCode = null as k8s.V1Status | null
  // run tests, the image should have a /tmc-run script
  const tmcRunSocket: WebSocket = await kubeExec.exec(
    "default",
    podName,
    containerName,
    ["timeout", `${DEFAULT_TASK_TIMEOUT_MS}ms`, "/tmc-run"],
    process.stdout,
    process.stderr,
    null,
    false,
    (statusCode) => {
      timeoutStatusCode = statusCode
    },
  )
  // wait for tmc-run to finish
  await new Promise((resolve, _reject) => {
    tmcRunSocket.onclose = () => {
      resolve(null)
    }
  })
  console.log("tmc-run finished")

  let timedOut = false
  if (timeoutStatusCode !== null) {
    if (timeoutStatusCode.code === 124) {
      // tmc-run timed out
      timedOut = true
    } else if (timeoutStatusCode.code === 125) {
      // timeout command failed
      throw "Failed to run `timeout`"
    } else if (timeoutStatusCode.code === 126) {
      // tmc-run could not be invoked
      throw "Failed to run `tmc-run`"
    } else if (timeoutStatusCode.code === 127) {
      // tmc-run could not be found
      throw "Failed to find `tmc-run`"
    } else if (timeoutStatusCode.code === 137) {
      // tmc-run was killed
      throw "`tmc-run` was killed (SIGKILL 9)"
    }
  } else {
    throw "Did not receive a status code from exec"
  }

  if (timedOut) {
    return {
      grading_progress: "Failed",
      score_given: 0,
      score_maximum: 0,
      feedback_text: "Test timed out",
      feedback_json: null,
    }
  }

  // read test results, the container should now have an /app/test_output.txt file
  const testOutputPath = "./test_output.txt"
  const kubeCp = new k8s.Cp(kubeConfig)
  await kubeCp.cpFromPod("default", podName, containerName, "/app/test_output.txt", testOutputPath)
  const testOutputBuffer = await fs.readFile(testOutputPath)
  const testOutput = JSON.parse(testOutputBuffer.toString())

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
      feedback_json: {
        stdout: "stdout" in testOutput.logs ? testOutput.logs["stdout"] : "",
        stderr: "stderr" in testOutput.logs ? testOutput.logs["stderr"] : "",
      },
    }
  } else {
    throw "Unexpected results"
  }
}
