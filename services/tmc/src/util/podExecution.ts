import * as k8s from "@kubernetes/client-node"
import { createReadStream, createWriteStream, promises as fs } from "fs"
import internal, { Writable } from "stream"
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
): Promise<{ timedOut: boolean; exitCode?: number }> {
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
  const execPromise = new Promise<{ timedOut: boolean; exitCode?: number }>((resolve) => {
    execSocket.onclose = (ev?: { code?: number; reason?: string }) => {
      const exitCode = ev?.code
      resolve({ timedOut: false, exitCode })
    }
  })
  const timeoutPromise = new Promise<{ timedOut: boolean; exitCode?: number }>((resolve) => {
    setTimeout(() => {
      resolve({ timedOut: true })
    }, timeoutMs)
  })
  return await Promise.race([execPromise, timeoutPromise])
}

const WAIT_FOR_POD_RUNNING_MS = 120_000

function captureStream(): { stream: Writable; getBuffer: () => Buffer } {
  const chunks: Buffer[] = []
  const stream = new Writable({
    write(chunk: Buffer | string, _enc, cb) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      cb()
    },
  })
  return {
    stream,
    getBuffer: () => Buffer.concat(chunks),
  }
}

async function waitForPodRunning(
  kubeApi: k8s.CoreV1Api,
  podName: string,
  maxWaitMs: number = WAIT_FOR_POD_RUNNING_MS,
): Promise<void> {
  const deadline = Date.now() + maxWaitMs
  let podPhase: string | null | undefined = null
  while (podPhase !== "Running") {
    if (Date.now() >= deadline) {
      throw new Error(
        `waitForPodRunning timed out for pod ${podName}, last phase: ${podPhase ?? "unknown"}`,
      )
    }
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
  const out = captureStream()
  const err = captureStream()
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
    out.stream,
    err.stream,
    submissionReadStream,
    DEFAULT_TASK_TIMEOUT_MS,
  )
  if (tarResult.timedOut) {
    throw new Error("Running tar inside the container timed out")
  }
  const exitCode = tarResult.exitCode
  if (exitCode !== undefined && exitCode !== 0) {
    throw new Error(`Tar exited with code ${exitCode}`)
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
  const out = captureStream()
  const err = captureStream()
  const tmcRunResult = await execWithTimeout(
    kubeExec,
    podName,
    CONTAINER_NAME,
    ["/tmc-run"],
    out.stream,
    err.stream,
    null,
    DEFAULT_TASK_TIMEOUT_MS,
  )
  if (tmcRunResult.timedOut) {
    logger.log("tmc-run timed out")
    return { timedOut: true }
  }
  const tmcExitCode = tmcRunResult.exitCode
  if (tmcExitCode !== undefined && tmcExitCode !== 0) {
    logger.log("tmc-run exited with code", tmcExitCode)
    return {
      timedOut: false,
      output: "",
      parsed: { status: "GENERIC_ERROR", exitCode: tmcExitCode },
    }
  }
  logger.log("tmc-run finished")

  /*
  cpFromPod is broken: https://github.com/kubernetes-client/javascript/issues/982
  while waiting for a fix, we do the copy via `cat`
  */
  const testOutputPath = temporaryFile()
  let testOutputWriteStream: ReturnType<typeof createWriteStream> | null = null
  try {
    testOutputWriteStream = createWriteStream(testOutputPath)
    const catOut = captureStream()
    const catResult = await execWithTimeout(
      kubeExec,
      podName,
      CONTAINER_NAME,
      ["cat", "/app/test_output.txt"],
      testOutputWriteStream,
      catOut.stream,
      null,
      DEFAULT_TASK_TIMEOUT_MS,
    )
    if (catResult.timedOut) {
      throw new Error("Running cat inside the container timed out")
    }
    if (catResult.exitCode !== undefined && catResult.exitCode !== 0) {
      throw new Error(`Cat /app/test_output.txt exited with code ${catResult.exitCode}`)
    }
    await new Promise<void>((resolve, reject) => {
      const s = testOutputWriteStream!
      s.on("finish", () => resolve()).on("error", reject)
    })
    testOutputWriteStream = null
    const testOutputBuffer = await fs.readFile(testOutputPath)
    const testOutputString = testOutputBuffer.toString()
    logger.log("got test output", "length:", testOutputString.length)
    const parsed = JSON.parse(testOutputString)
    return { timedOut: false, output: testOutputString, parsed }
  } finally {
    if (testOutputWriteStream && !testOutputWriteStream.destroyed) {
      testOutputWriteStream.destroy()
    }
    await fs.rm(testOutputPath, { force: true }).catch(() => {})
  }
}

/**
 * Run a submission in a sandbox pod: create pod, copy archive, run /tmc-run, read output, delete pod.
 * Returns TmcRunOutcome: either { timedOut: true }, or { timedOut: false, output, parsed } with the
 * parsed JSON result (or a synthetic result when the process exits non-zero or parsing fails).
 * Callers interpret the parsed payload for grade vs test.
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

  const sleepSeconds = Math.ceil((DEFAULT_TASK_TIMEOUT_MS + 10 * 60 * 1000) / 1000)
  const container = new k8s.V1Container()
  container.name = CONTAINER_NAME
  container.image = sandboxImage
  container.command = ["sleep", sleepSeconds.toString()]

  pod.spec = new k8s.V1PodSpec()
  pod.spec.containers = [container]

  try {
    logger.log("starting sandbox image", sandboxImage)
    await kubeApi.createNamespacedPod({ namespace: "default", body: pod, pretty: "true" })
    await waitForPodRunning(kubeApi, podName, WAIT_FOR_POD_RUNNING_MS)

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
