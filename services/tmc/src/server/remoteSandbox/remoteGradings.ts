import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"

import { gradingResultFromRun, serverErrorResult } from "@/server/gradingResult"
import { HOST_GIVES_UP_AFTER_MS, sendGradingUpdate } from "@/server/gradingUpdate"
import type { SubmissionSource } from "@/server/preparedSubmission"
import { withGradingSlot, withPreparedSubmission } from "@/server/preparedSubmission"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import { createLogger } from "@/util/logger"

import type { CallbackOutcome } from "./callback"
import type { RemoteSandboxConfig } from "./config"
import { remoteSandboxConfig } from "./config"
import type { DispatchResult, SandboxTask } from "./dispatch"
import { dispatchToSandbox } from "./dispatch"
import type {
  CallbackDecision,
  ClaimedGrading,
  RemoteGradingRequest,
  RemoteGradingStore,
  StoredGrading,
} from "./gradingStore"
import { connectRedis, RedisRemoteGradingStore } from "./redisGradingStore"
import type { SandboxTokenPayload } from "./token"
import { newNonce, sealToken } from "./token"

const logger = createLogger("remote-sandbox")

/** The sandbox neither retries a callback nor survives a restart with its tasks, so a silent task is sent again. */
const RESEND_AFTER_MS = 5 * 60_000
const MAX_SENDS = 3
/**
 * How long a send may take before another sweep sends the grading again: the download, the
 * preparation and the dispatch's 15-minute busy wait. Also what a process that stops mid-send
 * delays its grading by.
 */
const SEND_LEASE_MS = 20 * 60_000
/** How long a process may take to report an outcome before another reports it again. */
const REPORT_LEASE_MS = 5 * 60_000
const SWEEP_INTERVAL_MS = 20_000
const SWEEP_BATCH = 20
/** Covers the busy wait, the run and the resends, and ends just after the host gives up on the grading. */
const TOKEN_TTL_MS = 65 * 60_000
/** What the sandbox accepts as a `submission_id`, less the `cmf-` prefix. */
const HOST_SUBMISSION_ID = /^[A-Za-z0-9_-]{1,124}$/

/** An answer prepared for a sandbox. */
export interface SandboxSubmission {
  /** The `.tar.zst` tmc-langs' prepare-submission wrote. */
  archive: Buffer
  image: string
  points: string[]
}

/** What `RemoteGradings` reaches the outside world through; tests pass fakes. */
export interface RemoteGradingsDeps {
  store: RemoteGradingStore
  config: () => RemoteSandboxConfig
  /** Downloads and prepares a submission again for a resend, passing it to `run`. */
  prepare: <T>(
    submission: SubmissionSource,
    run: (prepared: SandboxSubmission) => Promise<T>,
  ) => Promise<T>
  dispatch: (task: SandboxTask, config: RemoteSandboxConfig) => Promise<DispatchResult>
  sendGradingUpdate: (
    url: string,
    claim: string | null,
    result: ExerciseTaskGradingResult,
  ) => Promise<boolean>
  now: () => number
}

/** A failure to report, unless a callback or a later send has taken over the grading. */
interface RejectedSend {
  /** The send it belongs to, or none when it ends the grading whichever send is the latest. */
  nonce?: string
  failure: ExerciseTaskGradingResult
}

/**
 * Gradings handed to remote sandboxes whose results have not arrived yet. Their state lives in
 * the store, so any process can take a callback for, or resend, any grading.
 */
export class RemoteGradings {
  private readonly deps: RemoteGradingsDeps
  /**
   * Resends this process has claimed but not yet begun, waiting for a slot or a download, by
   * their latest claim. Its sweeps renew their leases and take over claims on them.
   */
  private readonly queuedResends = new Map<string, number>()
  private readonly background = new Set<Promise<void>>()

  public constructor(deps: RemoteGradingsDeps) {
    this.deps = deps
  }

  /**
   * Hands a submission to a sandbox. Its result, or the failure when no sandbox takes it, then
   * reaches the host from this or another process.
   *
   * @throws when the store cannot keep the grading, so the caller reports it failed
   */
  public async start(request: RemoteGradingRequest, submission: SandboxSubmission): Promise<void> {
    const id = randomUUID()
    const submissionId = sandboxSubmissionId(request.gradingUpdateUrl)
    const now = this.deps.now()
    await this.deps.store.create(
      id,
      { request, submissionId, createdAtMs: now },
      now + SEND_LEASE_MS,
    )
    let rejected: RejectedSend | null
    try {
      rejected = await this.send(id, 0, request, submissionId, submission)
    } catch (e) {
      logger.error(`Failed to send submission ${submissionId} to a sandbox`, e)
      rejected = { failure: serverErrorResult() }
    }
    // A send that timed out can still have run and called back, so the callback's outcome or a
    // later send may own the grading by now; `settle` then refuses.
    try {
      if (rejected && (await this.settle(id, rejected))) {
        this.inBackground(
          this.report(id, request.gradingUpdateUrl, request.gradingUpdateClaim, rejected.failure),
          "Could not report a grading",
        )
      }
    } catch (e) {
      // The grading is kept, so throwing would have the caller report a second result.
      logger.error(`Could not settle submission ${submissionId}; its lease resends it`, e)
    }
  }

  /**
   * Reports a sandbox's result for a token this service sealed. Returns false, doing nothing, for
   * a nonce whose result was already handled.
   */
  public async handleCallback(
    payload: SandboxTokenPayload,
    outcome: CallbackOutcome,
  ): Promise<boolean> {
    const isSandboxError = "sandboxError" in outcome
    if (isSandboxError) {
      logger.error(`The sandbox failed to run a submission: ${outcome.sandboxError}`)
    }
    const result = callbackResult(payload, outcome)
    let decision: CallbackDecision
    let gradingId: string | null = null
    try {
      const now = this.deps.now()
      ;({ decision, gradingId } = await this.deps.store.recordCallback({
        nonce: payload.nonce,
        isSandboxError,
        maxSends: MAX_SENDS,
        nowMs: now,
        outcome: result,
        reportLeaseUntilMs: now + REPORT_LEASE_MS,
      }))
    } catch (e) {
      // The sandbox never calls again, so a result is reported unchecked rather than lost. A
      // sandbox failure is left to the resend already scheduled for the grading.
      logger.error("Could not record a sandbox result; handling it as unknown", e)
      decision = isSandboxError ? "ignored" : "unknown"
    }
    switch (decision) {
      case "duplicate":
        return false
      case "ignored":
        return true
      case "resend":
        this.sweepInBackground()
        return true
      case "unknown":
        this.inBackground(
          this.deps.sendGradingUpdate(payload.url, payload.claim, result).then(() => {}),
          "Could not report a grading",
        )
        return true
      case "report":
        if (gradingId !== null) {
          this.inBackground(
            this.report(gradingId, payload.url, payload.claim, result),
            "Could not report a grading",
          )
        }
        return true
    }
  }

  /** Resends, fails or reports again every grading that is due, waiting until that settles. */
  public async sweep(): Promise<void> {
    const now = this.deps.now()
    await Promise.all(
      [...this.queuedResends.keys()].map((id) =>
        this.deps.store.renewLease(id, now + SEND_LEASE_MS),
      ),
    )
    const claimed = await this.deps.store.claimDue(now, now + SEND_LEASE_MS, SWEEP_BATCH)
    const fresh: ClaimedGrading[] = []
    for (const grading of claimed) {
      if (this.queuedResends.has(grading.id)) {
        this.queuedResends.set(grading.id, grading.claim)
      } else {
        fresh.push(grading)
      }
    }
    await Promise.all(fresh.map((grading) => this.resend(grading)))
  }

  /** Settles once the reports and sweeps this process started in the background have. */
  public async drain(): Promise<void> {
    while (this.background.size > 0) {
      await Promise.allSettled(this.background)
    }
  }

  /** Sweeps every few seconds for as long as the process runs; returns a function that stops it. */
  public startSweeping(): () => void {
    const timer = setInterval(() => {
      this.sweepInBackground()
    }, SWEEP_INTERVAL_MS)
    timer.unref()
    return () => {
      clearInterval(timer)
    }
  }

  private sweepInBackground(): void {
    this.inBackground(this.sweep(), "Could not look for gradings to send again")
  }

  private inBackground(work: Promise<void>, failureMessage: string): void {
    const tracked = work
      .catch((e: unknown) => {
        logger.error(failureMessage, e)
      })
      .finally(() => {
        this.background.delete(tracked)
      })
    this.background.add(tracked)
  }

  private settle(id: string, rejected: RejectedSend): Promise<boolean> {
    return this.deps.store.settle(
      id,
      rejected.failure,
      this.deps.now() + REPORT_LEASE_MS,
      rejected.nonce,
    )
  }

  /**
   * Sends a settled grading's outcome to the host and finishes the grading once the host has it.
   * When the host does not take it, the grading stays settled and is reported again when its
   * lease ends.
   */
  private async report(
    id: string,
    url: string,
    claim: string | null,
    outcome: ExerciseTaskGradingResult,
  ): Promise<void> {
    if (await this.deps.sendGradingUpdate(url, claim, outcome)) {
      await this.deps.store.finish(id)
    } else {
      logger.error("The host did not take a grading update; it is reported again later")
    }
  }

  /** Dispatches once more; resolves to the rejection when no sandbox took it. */
  private async send(
    id: string,
    claim: number,
    request: RemoteGradingRequest,
    submissionId: string,
    submission: SandboxSubmission,
  ): Promise<RejectedSend | null> {
    const nonce = newNonce()
    const hasBegun = await this.deps.store.beginSend(
      id,
      nonce,
      claim,
      this.deps.now() + SEND_LEASE_MS,
    )
    this.queuedResends.delete(id)
    if (!hasBegun) {
      return null
    }
    const config = this.deps.config()
    const payload: SandboxTokenPayload = {
      v: 1,
      url: request.gradingUpdateUrl,
      claim: request.gradingUpdateClaim,
      points: submission.points,
      nonce,
      exp: this.deps.now() + TOKEN_TTL_MS,
    }
    // oxlint-disable-next-line typescript/no-non-null-assertion -- config validation requires a key
    const token = sealToken(payload, config.tokenKeys[0]!)
    const dispatched = await this.deps.dispatch(
      { archive: submission.archive, image: submission.image, submissionId, token },
      config,
    )
    if (!dispatched.accepted) {
      return { nonce, failure: dispatched.result }
    }
    try {
      await this.deps.store.scheduleResend(id, nonce, this.deps.now() + RESEND_AFTER_MS)
    } catch (e) {
      // A sandbox has the task: its callback or the send lease settles the grading.
      logger.error(`Could not schedule a resend of submission ${submissionId}`, e)
    }
    return null
  }

  /** Never throws: a failure that leaves the grading pending is retried when its lease ends. */
  private async resend({ id, claim }: ClaimedGrading): Promise<void> {
    this.queuedResends.set(id, claim)
    try {
      await this.resendClaimed(id, claim)
    } catch (e) {
      logger.error("Could not send or report a grading again", e)
    } finally {
      this.queuedResends.delete(id)
    }
  }

  private async resendClaimed(id: string, claim: number): Promise<void> {
    const grading = await this.deps.store.get(id)
    if (!grading) {
      await this.deps.store.finish(id)
      return
    }
    const { request, submissionId, sends, outcome } = grading
    if (this.isPastHostGiveUp(grading)) {
      logger.log(`Dropping submission ${submissionId}: the host has given up on it`)
      await this.deps.store.finish(id)
      return
    }
    if (outcome) {
      logger.log(`Reporting submission ${submissionId} again`)
      await this.report(id, request.gradingUpdateUrl, request.gradingUpdateClaim, outcome)
      return
    }
    let rejected: RejectedSend | null
    try {
      if (sends >= MAX_SENDS) {
        logger.error(`No result for submission ${submissionId} after ${sends.toString()} sends`)
        rejected = { failure: serverErrorResult() }
      } else {
        logger.log(`Sending submission ${submissionId} to a sandbox again`)
        // A sweep during the wait for a slot may have claimed the grading again for this process.
        rejected = await this.deps.prepare(request.submission, (submission) =>
          // The wait for a slot can outlast the host; the next claim then drops the grading.
          this.isPastHostGiveUp(grading)
            ? Promise.resolve(null)
            : this.send(id, this.queuedResends.get(id) ?? claim, request, submissionId, submission),
        )
      }
    } catch (e) {
      logger.error(`Failed to send submission ${submissionId} again`, e)
      rejected = { failure: serverErrorResult() }
    }
    if (rejected && (await this.settle(id, rejected))) {
      await this.report(id, request.gradingUpdateUrl, request.gradingUpdateClaim, rejected.failure)
    }
  }

  private isPastHostGiveUp(grading: StoredGrading): boolean {
    return this.deps.now() - grading.createdAtMs >= HOST_GIVES_UP_AFTER_MS
  }
}

/** The grading a callback's outcome amounts to. */
function callbackResult(
  payload: SandboxTokenPayload,
  outcome: CallbackOutcome,
): ExerciseTaskGradingResult {
  if ("sandboxError" in outcome) {
    return serverErrorResult()
  }
  try {
    return gradingResultFromRun(outcome.run, payload.points)
  } catch (e) {
    logger.error("Could not grade a sandbox result", e)
    return serverErrorResult()
  }
}

/**
 * `cmf-` and the host's submission id, the last segment of its grading-update URL, so sandbox
 * logs tell courses.mooc.fi's tasks from tmc-server's.
 */
export function sandboxSubmissionId(gradingUpdateUrl: string): string {
  const lastSegment = URL.parse(gradingUpdateUrl)?.pathname.split("/").findLast(Boolean) ?? ""
  return `cmf-${HOST_SUBMISSION_ID.test(lastSegment) ? lastSegment : randomUUID()}`
}

let service: RemoteGradings | null = null

/** The service's remote gradings, configured from the environment on first use. */
export function remoteGradings(): RemoteGradings {
  service ??= new RemoteGradings({
    store: new RedisRemoteGradingStore(connectRedis(remoteSandboxConfig().redisUrl)),
    config: remoteSandboxConfig,
    prepare: (submission, run) =>
      withGradingSlot(() =>
        withPreparedSubmission(submission, async (prepared) =>
          run({
            archive: await fs.readFile(prepared.archivePath),
            image: prepared.image,
            points: prepared.points,
          }),
        ),
      ),
    dispatch: (task, config) => dispatchToSandbox(task, config),
    sendGradingUpdate,
    now: Date.now,
  })
  return service
}
