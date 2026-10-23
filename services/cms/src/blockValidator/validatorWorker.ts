import { type ChildProcess, spawn } from "child_process"
import { existsSync } from "fs"
import path from "path"
import { Worker } from "worker_threads"

import type { WorkerReady, WorkerReply, WorkerRequest } from "./protocol"

/** Below the headless-lms client's 10 s timeout, so it gets our retryable 503 rather than its own. */
const REQUEST_TIMEOUT_MS = 8_000
const MAX_PENDING_REQUESTS = 32
const RESTART_DELAY_MS = 1_000
const WORKER_HEAP_LIMIT_MB = 1_024

export interface ValidatorResponse {
  status: number
  body: unknown
}

type WorkerRequestWithoutId = { kind: "validate"; body: unknown } | { kind: "block-schemas" }

interface PendingRequest {
  resolve: (response: ValidatorResponse) => void
  timer: NodeJS.Timeout
}

interface ValidatorState {
  worker: Worker | null
  isReady: boolean
  pending: Map<number, PendingRequest>
  nextRequestId: number
  bundleWatcher: ChildProcess | null
  restartTimer: NodeJS.Timeout | null
}

// Next bundles instrumentation and each API route separately, so module state isn't shared.
const STATE_KEY = Symbol.for("moocfi.cms.blockValidator")
const globalState = globalThis as typeof globalThis & { [STATE_KEY]?: ValidatorState }

const retryable = (reason: string): ValidatorResponse => ({
  status: 503,
  body: { retryable: true, error: reason },
})

// turbopackIgnore keeps Next's file tracing from treating these runtime paths as imports.
const cmsRoot = (): string => /* turbopackIgnore: true */ process.cwd()

/** Where the worker bundle is; the production image ships it, development builds it on start. */
export const workerBundlePath = (): string =>
  process.env.BLOCK_VALIDATOR_WORKER_PATH ??
  path.join(/* turbopackIgnore: true */ cmsRoot(), "dist", "block-validator-worker.cjs")

const state = (): ValidatorState => {
  globalState[STATE_KEY] ??= {
    worker: null,
    isReady: false,
    pending: new Map(),
    nextRequestId: 1,
    bundleWatcher: null,
    restartTimer: null,
  }
  return globalState[STATE_KEY]
}

const failPending = (current: ValidatorState, reason: string) => {
  for (const { resolve, timer } of current.pending.values()) {
    clearTimeout(timer)
    resolve(retryable(reason))
  }
  current.pending.clear()
}

const stopWorker = (current: ValidatorState, reason: string) => {
  const { worker } = current
  current.worker = null
  current.isReady = false
  failPending(current, reason)
  if (worker) {
    worker.removeAllListeners()
    void worker.terminate()
  }
}

const scheduleRestart = (current: ValidatorState) => {
  if (current.restartTimer) {
    return
  }
  current.restartTimer = setTimeout(() => {
    current.restartTimer = null
    startWorker(current)
  }, RESTART_DELAY_MS)
}

const startWorker = (current: ValidatorState) => {
  const bundle = workerBundlePath()
  if (!existsSync(/* turbopackIgnore: true */ bundle)) {
    console.error(`Block validator bundle missing at ${bundle}; agent writes will be refused.`)
    return
  }
  const worker = new Worker(/* turbopackIgnore: true */ bundle, {
    resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_LIMIT_MB },
  })
  current.worker = worker
  worker.on("message", (message: WorkerReply | WorkerReady) => {
    if ("kind" in message) {
      current.isReady = true
      return
    }
    const request = current.pending.get(message.id)
    if (request) {
      current.pending.delete(message.id)
      clearTimeout(request.timer)
      request.resolve({ status: message.status, body: message.body })
    }
  })
  worker.on("error", (error) => {
    console.error("Block validator worker failed", error)
  })
  worker.on("exit", (code) => {
    if (current.worker !== worker) {
      return
    }
    console.error(`Block validator worker exited with code ${code}; restarting.`)
    stopWorker(current, "The block validator restarted.")
    scheduleRestart(current)
  })
}

/** Rebuilds the bundle on source changes in development and restarts the worker on each build. */
const startBundleWatcher = (current: ValidatorState) => {
  const watcher = spawn(
    process.execPath,
    [
      path.join(/* turbopackIgnore: true */ cmsRoot(), "scripts", "buildBlockValidatorWorker.mjs"),
      "--watch",
    ],
    { cwd: cmsRoot(), stdio: ["ignore", "pipe", "inherit"] },
  )
  current.bundleWatcher = watcher
  watcher.stdout?.on("data", (chunk: Buffer) => {
    if (chunk.toString().includes("block-validator-worker: built")) {
      stopWorker(current, "The block validator is reloading.")
      startWorker(current)
    }
  })
  watcher.on("exit", (code) => {
    console.error(`Block validator bundle watcher exited with code ${code}.`)
    current.bundleWatcher = null
  })
}

/** Starts the validator worker once per server process; later calls do nothing. */
export const startBlockValidator = (): void => {
  const current = state()
  if (current.worker || current.bundleWatcher || current.restartTimer) {
    return
  }
  if (process.env.NODE_ENV === "development" && !process.env.BLOCK_VALIDATOR_WORKER_PATH) {
    startBundleWatcher(current)
  } else {
    startWorker(current)
  }
}

/** Whether the worker has loaded Gutenberg and can answer at once. */
export const isBlockValidatorReady = (): boolean => state().isReady

/** Sends a request to the worker; never rejects, and answers 503 retryable when it can't serve. */
export const callBlockValidator = (request: WorkerRequestWithoutId): Promise<ValidatorResponse> => {
  startBlockValidator()
  const current = state()
  const { worker } = current
  if (!worker || !current.isReady) {
    return Promise.resolve(retryable("The block validator is starting."))
  }
  if (current.pending.size >= MAX_PENDING_REQUESTS) {
    return Promise.resolve(retryable("The block validator is busy."))
  }
  const id = current.nextRequestId++
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // A request this slow means the worker is stuck; a fresh one serves the retries.
      current.pending.delete(id)
      resolve(retryable("The block validator timed out."))
      stopWorker(current, "The block validator timed out.")
      scheduleRestart(current)
    }, REQUEST_TIMEOUT_MS)
    current.pending.set(id, { resolve, timer })
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker_threads port, not a window
    worker.postMessage({ id, ...request } as WorkerRequest)
  })
}

/** Stops the worker and the bundle watcher; for tests. */
export const stopBlockValidator = async (): Promise<void> => {
  const current = state()
  if (current.restartTimer) {
    clearTimeout(current.restartTimer)
    current.restartTimer = null
  }
  current.bundleWatcher?.kill()
  current.bundleWatcher = null
  const { worker } = current
  stopWorker(current, "The block validator stopped.")
  await worker?.terminate()
}
