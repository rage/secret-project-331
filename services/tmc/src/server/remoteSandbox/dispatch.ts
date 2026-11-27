import { createHmac } from "node:crypto"

import { failedGradingResult, serverErrorResult } from "@/server/gradingResult"
import { isRecord } from "@/shared-module/common/utils/objects"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import { createLogger } from "@/util/logger"
import { delay } from "@/util/podExecution"

import { parseJson } from "./callback"
import type { RemoteSandboxConfig, SandboxServer } from "./config"

const { log, error } = createLogger("remote-sandbox")

/** The sandbox runs only images under this prefix. */
const ALLOWED_IMAGE_PREFIX = "eu.gcr.io/moocfi-public/tmc-sandbox-"
const REQUEST_TIMEOUT_MS = 30_000
const BUSY_BUDGET_MS = 15 * 60_000
const MIN_BUSY_RETRY_DELAY_MS = 5_000
const MAX_BUSY_RETRY_DELAY_MS = 10_000

/** A prepared submission to hand to a sandbox. */
export interface SandboxTask {
  /** The `.tar.zst` tmc-langs' prepare-submission wrote. */
  archive: Buffer
  image: string
  /** Shows up in the sandbox's logs; `^[A-Za-z0-9_-]{1,128}$`. */
  submissionId: string
  token: string
}

/** Whether a sandbox took the task, else the `Failed` grading to report. */
export type DispatchResult =
  | { accepted: true }
  | { accepted: false; result: ExerciseTaskGradingResult }

/** Test seams for time and server order. */
export interface DispatchClock {
  now: () => number
  sleep: (ms: number) => Promise<void>
  shuffle: <T>(items: T[]) => T[]
}

const realClock: DispatchClock = {
  now: Date.now,
  sleep: delay,
  shuffle: (items) =>
    items
      .map((item) => ({ item, key: Math.random() }))
      .toSorted((a, b) => a.key - b.key)
      .map(({ item }) => item),
}

/**
 * Hands a task to the first sandbox that accepts it, trying the servers in random order and,
 * while all are busy or unreachable, again every few seconds for up to 15 minutes. A task no
 * server will run comes back as a `Failed` grading.
 */
export async function dispatchToSandbox(
  task: SandboxTask,
  config: RemoteSandboxConfig,
  clock: DispatchClock = realClock,
): Promise<DispatchResult> {
  if (!task.image.startsWith(ALLOWED_IMAGE_PREFIX)) {
    error(`Sandbox image ${task.image} is not one the grading servers run`)
    return { accepted: false, result: serverErrorResult() }
  }
  const form = taskForm(task, config)
  const giveUpAt = clock.now() + BUSY_BUDGET_MS
  for (;;) {
    let didEveryServerRefuse = true
    for (const server of clock.shuffle(config.servers)) {
      const outcome = await postTask(server, task.submissionId, form)
      if (outcome === "accepted") {
        return { accepted: true }
      }
      if (outcome !== "busy" && outcome !== "unavailable" && outcome !== "refused") {
        return { accepted: false, result: outcome }
      }
      didEveryServerRefuse &&= outcome === "refused"
    }
    // Credentials or URLs that every server refuses will not start working while we wait.
    if (didEveryServerRefuse) {
      return { accepted: false, result: serverErrorResult() }
    }
    const delayMs =
      MIN_BUSY_RETRY_DELAY_MS + Math.random() * (MAX_BUSY_RETRY_DELAY_MS - MIN_BUSY_RETRY_DELAY_MS)
    if (clock.now() + delayMs > giveUpAt) {
      log(`No grading server accepted submission ${task.submissionId}; giving up`)
      return {
        accepted: false,
        result: failedGradingResult("The grading servers are busy. Submit again later.", {
          feedback_key: "sandbox_busy",
        }),
      }
    }
    await clock.sleep(delayMs)
  }
}

function taskForm(task: SandboxTask, config: RemoteSandboxConfig): FormData {
  const form = new FormData()
  form.append("submission_id", task.submissionId)
  form.append("docker_image", task.image)
  form.append("notify", config.notifyUrl)
  if (config.notifySecret) {
    form.append(
      "notify_signature",
      createHmac("sha256", config.notifySecret).update(config.notifyUrl, "utf8").digest("hex"),
    )
  }
  form.append("token", task.token)
  form.append(
    "file",
    new Blob([new Uint8Array(task.archive)], { type: "application/zstd" }),
    "submission.tar.zst",
  )
  return form
}

async function postTask(
  server: SandboxServer,
  submissionId: string,
  form: FormData,
): Promise<"accepted" | "busy" | "unavailable" | "refused" | ExerciseTaskGradingResult> {
  const headers: HeadersInit = server.authorization ? { authorization: server.authorization } : {}

  let response: Response
  let body: string
  try {
    response = await fetch(`${server.baseUrl}/tasks.json`, {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    body = await response.text()
  } catch (e) {
    // A timeout can hide a task the server accepted; the callback nonce makes a second run harmless.
    log(`Grading server ${server.baseUrl} is unreachable: ${String(e)}`)
    return "unavailable"
  }

  if (response.ok) {
    log(`Grading server ${server.baseUrl} accepted submission ${submissionId}`)
    return "accepted"
  }
  if (response.status >= 500) {
    // Older sandbox servers answer busy with a 500 carrying `status`, as tmc-server expects.
    if (response.status === 503 || hasStatusKey(body)) {
      return "busy"
    }
    log(`Grading server ${server.baseUrl} failed: ${response.status.toString()} ${body}`)
    return "unavailable"
  }
  if (response.status === 429) {
    return "busy"
  }
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    // One server's credentials or route, not the task: the others may take it.
    error(
      `Grading server ${server.baseUrl} refused the task: ${response.status.toString()} ${body}`,
    )
    return "refused"
  }
  if (response.status === 413) {
    return failedGradingResult("The submission is too large to be graded", {
      feedback_key: "submission_too_large",
    })
  }
  error(`Grading server ${server.baseUrl} rejected the task: ${response.status.toString()} ${body}`)
  return serverErrorResult()
}

function hasStatusKey(body: string): boolean {
  const parsed = parseJson(body)
  return isRecord(parsed) && "status" in parsed
}
