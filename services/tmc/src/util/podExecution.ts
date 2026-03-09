import * as k8s from "@kubernetes/client-node"
import { createReadStream, createWriteStream, promises as fs } from "fs"
import internal from "stream"
import { temporaryFile } from "tempy"
import { v4 } from "uuid"

import { initKube } from "@/lib"
import { Logger } from "@/util/logger"

const DEFAULT_TASK_TIMEOUT_MS = 60000
const CONTAINER_NAME = "tmc-submission-execution-sandbox"

export async function execWithTimeout(
  kubeExec: k8s.Exec,
  podName: string,
  containerName: string,
  command: Array<string>,
  stdout: internal.Writable,
  stderr: internal.Writable,
  stdin: internal.Readable | null,
  timeoutMs: number,
): Promise<{ timedOut: boolean }> {
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

async function waitForPodRunning(kubeApi: k8s.CoreV1Api, podName: string): Promise<void> {
  let podPhase = null
  while (podPhase !== "Running") {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    await delay(500)

    const podStatus = await kubeApi.readNamespacedPodStatus({
      namespace: "default",
      name: podName,
      pretty: "true",
    })
    podPhase = podStatus.status?.phase
    if (podPhase !== "Pending" && podPhase !== "Running") {
      throw new Error(`Unexpected phase ${podPhase}`)
    }
  }
}

async function copySubmissionToPod(
  kubeExec: k8s.Exec,
  podName: string,
  submissionPath: string,
): Promise<void> {
  const submissionReadStream = createReadStream(submissionPath)
  const tarResult = await execWithTimeout(
    kubeExec,
    podName,
    CONTAINER_NAME,
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
    DEFAULT_TASK_TIMEOUT_MS,
  )
  if (tarResult.timedOut) {
    throw new Error("Running tar inside the container timed out")
  }
}

export type TmcRunOutcome =
  | { timedOut: true }
  | { timedOut: false; output: string; parsed: unknown }

async function runTmcAndReadOutput(
  kubeExec: k8s.Exec,
  podName: string,
  logger: Logger,
): Promise<TmcRunOutcome> {
  const tmcRunResult = await execWithTimeout(
    kubeExec,
    podName,
    CONTAINER_NAME,
    ["/tmc-run"],
    process.stdout,
    process.stderr,
    null,
    DEFAULT_TASK_TIMEOUT_MS,
  )
  if (tmcRunResult.timedOut) {
    logger.log("tmc-run timed out")
    return { timedOut: true }
  }
  logger.log("tmc-run finished")

  /*
  cpFromPod is broken: https://github.com/kubernetes-client/javascript/issues/982
  while waiting for a fix, we do the copy via `cat`
  */
  const testOutputPath = temporaryFile()
  try {
    const testOutputWriteStream = createWriteStream(testOutputPath)
    const catResult = await execWithTimeout(
      kubeExec,
      podName,
      CONTAINER_NAME,
      ["cat", "/app/test_output.txt"],
      testOutputWriteStream,
      process.stderr,
      null,
      DEFAULT_TASK_TIMEOUT_MS,
    )
    if (catResult.timedOut) {
      throw new Error("Running cat inside the container timed out")
    }
    const testOutputBuffer = await fs.readFile(testOutputPath)
    const testOutputString = testOutputBuffer.toString()
    logger.log(`got output ${testOutputString} end`)
    const parsed = JSON.parse(testOutputString)
    return { timedOut: false, output: testOutputString, parsed }
  } finally {
    await fs.rm(testOutputPath, { force: true }).catch(() => {})
  }
}

/**
 * Run a submission in a sandbox pod: create pod, copy archive, run /tmc-run, read output, delete pod.
 * Returns the raw parsed JSON output. The caller interprets it (grade vs test).
 */
export async function runInSandboxPod(
  sandboxImage: string,
  submissionPath: string,
  logger: Logger,
): Promise<TmcRunOutcome> {
  const { config: kubeConfig, api: kubeApi } = initKube()

  const podId = v4()
  const podName = `tmc-sandbox-pod-${podId}`

  const pod = new k8s.V1Pod()
  pod.metadata = new k8s.V1ObjectMeta()
  pod.metadata.name = podName

  const container = new k8s.V1Container()
  container.name = CONTAINER_NAME
  container.image = sandboxImage
  container.command = ["sleep", (DEFAULT_TASK_TIMEOUT_MS + 10 * 60 * 1000).toString()]

  pod.spec = new k8s.V1PodSpec()
  pod.spec.containers = [container]

  try {
    logger.log("starting sandbox image", sandboxImage)
    await kubeApi.createNamespacedPod({ namespace: "default", body: pod, pretty: "true" })
    await waitForPodRunning(kubeApi, podName)

    const kubeExec = new k8s.Exec(kubeConfig)
    await copySubmissionToPod(kubeExec, podName, submissionPath)
    return await runTmcAndReadOutput(kubeExec, podName, logger)
  } finally {
    logger.log(`deleting pod ${podName}`)
    try {
      await kubeApi.deleteNamespacedPod({ name: podName, namespace: "default", pretty: "true" })
    } catch (_e) {
      logger.error("failed to delete pod")
    }
  }
}
