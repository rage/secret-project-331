/* eslint-disable i18next/no-literal-string */
import * as k8s from "@kubernetes/client-node"
import { createReadStream, createWriteStream, promises as fs } from "fs"
import { NextApiRequest, NextApiResponse } from "next"
import path from "path"
import { temporaryDirectory, temporaryFile } from "tempy"
import { v4 } from "uuid"

import {
  ClientErrorResponse,
  downloadStream,
  GradingResult,
  initKubeApi,
  initKubeConfig,
  pendingSubmissions,
} from "../../lib"
import { GradingRequest } from "../../shared-module/exercise-service-protocol-types-2"
import { Compression } from "../../tmc/cli"
import { isRunResult } from "../../tmc/cli.guard"
import {
  compressProject,
  extractProject,
  fastAvailablePoints,
  prepareSubmission,
} from "../../tmc/langs"
import { PrivateSpec, Submission } from "../../util/stateInterfaces"

export default async (
  req: NextApiRequest,
  res: NextApiResponse<GradingResult | ClientErrorResponse>,
): Promise<void> => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  try {
    return await handlePost(req, res)
  } catch (e) {
    console.log(e)
    return res.status(500).send({ message: "Internal server error" })
  }
}

type TmcGradingRequest = GradingRequest<PrivateSpec, Submission>

const handlePost = async (
  req: NextApiRequest,
  res: NextApiResponse<GradingResult | ClientErrorResponse>,
): Promise<void> => {
  console.log(req.body)
  const { exercise_spec, submission_data } = req.body as TmcGradingRequest

  // prepare submission for the grading pod
  const submissionArchivePath = temporaryFile()
  let compression: Compression
  let naive: boolean
  if (exercise_spec.type === "editor" && submission_data.type === "editor") {
    // download submission
    const archiveDownloadUrl = submission_data.archiveDownloadUrl
    await downloadStream(archiveDownloadUrl, submissionArchivePath)
    // todo: support other compression methods?
    compression = "zstd"
    naive = false
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
    await compressProject(submissionDir, submissionArchivePath, "tar", true)
    compression = "tar"
    naive = true
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
    compression,
    naive,
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

  const gradingResult: GradingResult = await pendingSubmission
  res.status(200).json(gradingResult)
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
  container.command = ["sleep", "infinity"]
  pod.spec = new k8s.V1PodSpec()
  pod.spec.containers = [container]

  // start pod and wait for it to start
  console.log("starting sandbox image", sandboxImage)
  await kubeApi.createNamespacedPod("default", pod, "true")
  let podPhase = null
  while (podPhase !== "Running") {
    // poll once per second
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    await delay(1000)

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
    ["tar", "--verbose", "--extract", "--file", "-", "--directory", "/app/"],
    process.stdout,
    process.stderr,
    submissionReadStream,
    // tty = false, the piping does not work otherwise
    false,
  )

  // run tests, the image should have a /tmc-run script
  const tmcRunSocket = await kubeExec.exec(
    "default",
    podName,
    containerName,
    ["/tmc-run"],
    process.stdout,
    process.stderr,
    null,
    false,
  )
  // wait for tmc-run to finish
  await new Promise((resolve, _reject) => {
    tmcRunSocket.onclose = () => {
      resolve(null)
    }
  })
  console.log("tmc-run finished")

  // read test results, the container should now have an /app/test_output.txt file
  const catOutputFile = temporaryFile()
  const catOutputStream = createWriteStream(catOutputFile)
  const catSocket = await kubeExec.exec(
    "default",
    podName,
    containerName,
    ["cat", "/app/test_output.txt"],
    catOutputStream,
    process.stderr,
    null,
    false,
  )
  // wait for cat to finish
  await new Promise((resolve, _reject) => {
    catSocket.onclose = () => {
      resolve(null)
    }
  })
  const testOutputBuffer = await fs.readFile(catOutputFile)
  const testOutput = JSON.parse(testOutputBuffer.toString())
  let gradingResult: GradingResult
  if (isRunResult(testOutput)) {
    gradingResult = {
      grading_progress: "FullyGraded",
      score_given: testOutput.testResults.flatMap((tr) => tr.points).length,
      score_maximum: points.length,
      feedback_text: null,
      feedback_json: null,
    }
  } else {
    throw "Unexpected results"
  }

  // delete the pod now that we're done
  console.log(`deleting pod ${podName}`)
  await kubeApi.deleteNamespacedPod(podName, "default", "true")

  return gradingResult
}
