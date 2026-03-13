import * as k8s from "@kubernetes/client-node"
import { createReadStream, createWriteStream, promises as fs } from "fs"
import internal, { Writable } from "stream"
import { temporaryFile } from "tempy"
import { v4 } from "uuid"

import { initKube } from "@/lib"
import { Logger } from "@/util/logger"

const DEFAULT_TASK_TIMEOUT_MS = 60000
const CONTAINER_NAME = "tmc-submission-execution-sandbox"

/**
 * Execute a command in a pod with a maximum wall-clock wait of `timeoutMs`.
 *
 * - When `timedOut === true`, the helper gave up waiting (best-effort closes the exec socket),
 *   and `exitCode` will be `undefined`; callers should treat this as a canceled/unknown outcome.
 * - When `timedOut === false`, the exec completed and `exitCode` is the process exit code
 *   (0 for success, non-zero for failure) when it could be observed from the Kubernetes status
 *   stream; if it cannot be determined, `exitCode` may be `undefined`.
 *
 * Unexpected errors establishing the exec or from the client will reject/throw and propagate.
 */
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
  let observedStatusExitCode: number | undefined
  let observedStatus = false
  let resolved = false

  const extractExitCodeFromStatus = (status: unknown): number | undefined => {
    const s = status as {
      details?: { causes?: Array<{ reason?: string; message?: string }> }
    } | null
    const causes = s?.details?.causes
    if (!Array.isArray(causes)) {
      return undefined
    }
    const exitCause =
      causes.find((c) => c?.reason === "ExitCode") ?? causes.find((c) => c?.message != null)
    const msg = exitCause?.message
    if (msg == null) {
      return undefined
    }
    const parsed = Number.parseInt(msg, 10)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  const execSocket = await kubeExec.exec(
    "default",
    podName,
    containerName,
    command,
    stdout,
    stderr,
    stdin,
    false,
    (status: unknown) => {
      observedStatus = true
      observedStatusExitCode = extractExitCodeFromStatus(status)
    },
  )
  const execPromise = new Promise<{ timedOut: boolean; exitCode?: number }>((resolve) => {
    const resolveOnce = (result: { timedOut: boolean; exitCode?: number }) => {
      if (resolved) {
        return
      }
      resolved = true
      resolve(result)
    }
    execSocket.onclose = (ev?: { code?: number; reason?: string }) => {
      // Prefer the Kubernetes status channel's exit code when available.
      // Fall back to the close event's code only if we never observed status.
      const exitCode = observedStatus ? observedStatusExitCode : ev?.code
      resolveOnce({ timedOut: false, exitCode })
    }
  })
  const timeoutPromise = new Promise<{ timedOut: boolean; exitCode?: number }>((resolve) => {
    const timer = setTimeout(() => {
      // Best-effort stop the exec stream; the server-side process may still run.
      try {
        execSocket.close()
      } catch (_e) {
        // ignore
      }
      resolve({ timedOut: true })
    }, timeoutMs)
    execPromise.finally(() => clearTimeout(timer)).catch(() => {})
  })
  return await Promise.race([execPromise, timeoutPromise])
}

const WAIT_FOR_POD_RUNNING_MS = 120_000

function captureStream(maxBytes: number = 0): { stream: Writable; getBuffer: () => Buffer } {
  if (maxBytes === 0) {
    return {
      stream: new Writable({
        write(_chunk: Buffer | string, _enc, cb) {
          cb()
        },
      }),
      getBuffer: () => Buffer.alloc(0),
    }
  }

  const chunks: Buffer[] = []
  let totalBytes = 0

  const trimToMax = () => {
    while (totalBytes > maxBytes && chunks.length > 0) {
      const first = chunks[0]!
      const overflow = totalBytes - maxBytes
      if (overflow >= first.length) {
        chunks.shift()
        totalBytes -= first.length
      } else {
        chunks[0] = first.subarray(overflow)
        totalBytes -= overflow
      }
    }
  }

  const stream = new Writable({
    write(chunk: Buffer | string, _enc, cb) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      if (buf.length >= maxBytes) {
        chunks.length = 0
        chunks.push(buf.subarray(buf.length - maxBytes))
        totalBytes = maxBytes
        cb()
        return
      }
      chunks.push(buf)
      totalBytes += buf.length
      trimToMax()
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
  const out = captureStream(0)
  const err = captureStream(0)
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
  const out = captureStream(0)
  const err = captureStream(0)
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
    const catOut = captureStream(0)
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
    try {
      const parsed = JSON.parse(testOutputString)
      return { timedOut: false, output: testOutputString, parsed }
    } catch (_e) {
      return {
        timedOut: false,
        output: testOutputString,
        parsed: { status: "GENERIC_ERROR", error: "INVALID_TEST_OUTPUT_JSON" },
      }
    }
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
  pod.spec.automountServiceAccountToken = false

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
