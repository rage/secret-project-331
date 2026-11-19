import { type ChildProcess, spawn } from "child_process"
import { existsSync } from "fs"
import path from "path"
import { Worker } from "worker_threads"

import type {
  ValidatorRequest,
  ValidatorResponse,
  WorkerReady,
  WorkerReply,
  WorkerRequest,
} from "./protocol"

/** Timing and memory limits of the validator; tests shorten them. */
export interface ValidatorLimits {
  /** Every request whose caller sent no timeout is answered within this, queued or not. */
  requestDeadlineMs: number
  /** A request the worker spends longer on is answered 413 and the worker replaced. */
  processingTimeoutMs: number
  /** Keeps the worker plus the Next server under the CMS pod's memory limit. */
  workerHeapLimitMb: number
}

const DEFAULT_LIMITS: ValidatorLimits = {
  requestDeadlineMs: 9_000,
  processingTimeoutMs: 8_000,
  workerHeapLimitMb: 512,
}
const MAX_PENDING_REQUESTS = 32
/** A caller that sent its timeout is answered this much before it, so it hears our retryable 503. */
const DEADLINE_MARGIN_MS = 1_000
const RESTART_DELAY_MS = 1_000

interface PendingRequest {
  message: WorkerRequest
  resolve: (response: ValidatorResponse) => void
  deadline: NodeJS.Timeout
}

interface InFlightRequest {
  request: PendingRequest
  processingTimer: NodeJS.Timeout
}

interface ValidatorState {
  limits: ValidatorLimits
  worker: Worker | null
  isReady: boolean
  /**
   * Requests waiting for the worker, oldest first. The worker gets one at a time, so a timeout
   * blames only the request it is stuck on.
   */
  queue: PendingRequest[]
  inFlight: InFlightRequest | null
  nextRequestId: number
  bundleWatcher: ChildProcess | null
  restartTimer: NodeJS.Timeout | null
}

// Next bundles instrumentation and each API route separately, so module state isn't shared.
const STATE_KEY = Symbol.for("moocfi.cms.blockValidator")
const globalState = globalThis as typeof globalThis & { [STATE_KEY]?: ValidatorState }

const unavailable = (reason: string): ValidatorResponse => ({
  status: 503,
  body: { error: reason },
})

// headless-lms retries every 5xx, and this request would fail the same way again.
const tooLarge = (reason: string): ValidatorResponse => ({
  status: 413,
  body: { error: `${reason} Write fewer or smaller blocks per call.` },
})

// turbopackIgnore keeps Next's file tracing from treating these runtime paths as imports.
const cmsRoot = (): string => /* turbopackIgnore: true */ process.cwd()

/** Where the worker bundle is; the production image ships it, development builds it on start. */
const workerBundlePath = (): string =>
  process.env.BLOCK_VALIDATOR_WORKER_PATH ??
  path.join(/* turbopackIgnore: true */ cmsRoot(), "dist", "block-validator-worker.cjs")

const state = (): ValidatorState => {
  globalState[STATE_KEY] ??= {
    limits: DEFAULT_LIMITS,
    worker: null,
    isReady: false,
    queue: [],
    inFlight: null,
    nextRequestId: 1,
    bundleWatcher: null,
    restartTimer: null,
  }
  return globalState[STATE_KEY]
}

// Timeouts and restarts may answer a request again; only the first answer counts.
const answer = (request: PendingRequest, response: ValidatorResponse) => {
  clearTimeout(request.deadline)
  request.resolve(response)
}

const dispatchNext = (current: ValidatorState) => {
  const { worker } = current
  if (!worker || !current.isReady || current.inFlight) {
    return
  }
  const request = current.queue.shift()
  if (!request) {
    return
  }
  const processingTimer = setTimeout(() => {
    answer(request, tooLarge("Validating the blocks took too long."))
    stopWorker(current, "The block validator timed out.")
    scheduleRestart(current)
  }, current.limits.processingTimeoutMs)
  current.inFlight = { request, processingTimer }
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker_threads port, not a window
  worker.postMessage(request.message)
}

/** Ends the worker; the request it was on is answered 503 and queued ones wait for the next. */
const stopWorker = (current: ValidatorState, reason: string) => {
  const { worker, inFlight } = current
  current.worker = null
  current.isReady = false
  current.inFlight = null
  if (inFlight) {
    clearTimeout(inFlight.processingTimer)
    answer(inFlight.request, unavailable(reason))
  }
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
    if (!current.worker) {
      startWorker(current)
    }
  }, RESTART_DELAY_MS)
}

const startWorker = (current: ValidatorState) => {
  stopWorker(current, "The block validator restarted.")
  const bundle = workerBundlePath()
  if (!existsSync(/* turbopackIgnore: true */ bundle)) {
    console.error(`Block validator bundle missing at ${bundle}; agent writes will be refused.`)
    return
  }
  const worker = new Worker(/* turbopackIgnore: true */ bundle, {
    resourceLimits: { maxOldGenerationSizeMb: current.limits.workerHeapLimitMb },
  })
  current.worker = worker
  worker.on("message", (message: WorkerReply | WorkerReady) => {
    if ("kind" in message) {
      current.isReady = true
      dispatchNext(current)
      return
    }
    const { inFlight } = current
    if (inFlight?.request.message.id !== message.id) {
      return
    }
    clearTimeout(inFlight.processingTimer)
    current.inFlight = null
    answer(inFlight.request, { status: message.status, body: message.body })
    dispatchNext(current)
  })
  worker.on("error", (error: Error & { code?: string }) => {
    console.error("Block validator worker failed", error)
    if (error.code === "ERR_WORKER_OUT_OF_MEMORY" && current.inFlight) {
      answer(current.inFlight.request, tooLarge("Validating the blocks ran out of memory."))
    }
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
      if (current.restartTimer) {
        clearTimeout(current.restartTimer)
        current.restartTimer = null
      }
      startWorker(current)
    }
  })
  watcher.on("exit", (code) => {
    console.error(`Block validator bundle watcher exited with code ${code}.`)
    current.bundleWatcher = null
  })
}

/** Whether the worker runs or will: a restart or bundle build is pending. */
const isStarted = (current: ValidatorState): boolean =>
  current.worker !== null || current.bundleWatcher !== null || current.restartTimer !== null

/**
 * Starts the validator worker once per server process; later calls do nothing. `limits` applies
 * only when this call starts the worker.
 */
export const startBlockValidator = (limits?: Partial<ValidatorLimits>): void => {
  const current = state()
  if (isStarted(current)) {
    return
  }
  current.limits = { ...DEFAULT_LIMITS, ...limits }
  if (process.env.NODE_ENV === "development" && !process.env.BLOCK_VALIDATOR_WORKER_PATH) {
    startBundleWatcher(current)
  } else {
    startWorker(current)
  }
}

/** Whether the worker has loaded Gutenberg and can answer at once. */
export const isBlockValidatorReady = (): boolean => state().isReady

/**
 * Queues a request for the worker. Never rejects: answers 503 when the worker is down,
 * busy past the deadline or restarting, and 413 when the request itself is too slow or too big.
 * The deadline is `clientTimeoutMs` less a margin, or `requestDeadlineMs` without one.
 */
export const callBlockValidator = (
  request: ValidatorRequest,
  clientTimeoutMs?: number,
): Promise<ValidatorResponse> => {
  startBlockValidator()
  const current = state()
  if (!isStarted(current)) {
    return Promise.resolve(unavailable("The block validator isn't running."))
  }
  if (current.queue.length + (current.inFlight ? 1 : 0) >= MAX_PENDING_REQUESTS) {
    return Promise.resolve(unavailable("The block validator is busy."))
  }
  const deadlineMs =
    clientTimeoutMs === undefined
      ? current.limits.requestDeadlineMs
      : Math.max(clientTimeoutMs - DEADLINE_MARGIN_MS, 0)
  const message = { id: current.nextRequestId++, ...request } as WorkerRequest
  return new Promise((resolve) => {
    const pending: PendingRequest = {
      message,
      resolve,
      deadline: setTimeout(() => {
        current.queue = current.queue.filter((queued) => queued !== pending)
        answer(
          pending,
          unavailable(
            current.isReady ? "The block validator is busy." : "The block validator is starting.",
          ),
        )
      }, deadlineMs),
    }
    current.queue.push(pending)
    dispatchNext(current)
  })
}

/** Stops the worker and the bundle watcher and answers everything waiting; for tests. */
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
  for (const queued of current.queue) {
    answer(queued, unavailable("The block validator stopped."))
  }
  current.queue = []
  await worker?.terminate()
}
