import { randomUUID } from "node:crypto"

import {
  failedGradingResult,
  gradingResultFromRun,
  serverErrorResult,
} from "@/server/gradingResult"
import { sendGradingUpdate } from "@/server/gradingUpdate"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import { createLogger } from "@/util/logger"

import type { CallbackOutcome } from "./callback"
import type { RemoteSandboxConfig } from "./config"
import { remoteSandboxConfig } from "./config"
import type { DispatchResult, SandboxTask } from "./dispatch"
import { dispatchToSandbox } from "./dispatch"
import type { SandboxTokenPayload } from "./token"
import { newNonce, sealToken } from "./token"

const logger = createLogger("remote-sandbox")

/** The sandbox neither retries a callback nor survives a restart with its tasks, so a silent task is sent again. */
const RESEND_AFTER_MS = 5 * 60_000
const MAX_SENDS = 3
/** Covers the busy wait, the run and the resends, and ends just after the host gives up on the grading. */
const TOKEN_TTL_MS = 65 * 60_000
/** How long a used nonce is remembered, beyond any token's lifetime. */
const CONSUMED_NONCE_TTL_MS = 2 * 60 * 60_000
/** Archives are kept in memory for resends; the service's own memory limit is small. */
const MAX_PENDING_ARCHIVE_BYTES = 64 * 1024 * 1024
/** What the sandbox accepts as a `submission_id`, less the `cmf-` prefix. */
const HOST_SUBMISSION_ID = /^[A-Za-z0-9_-]{1,124}$/

/** A prepared submission to grade on a remote sandbox. */
export interface RemoteGradingRequest {
  archive: Buffer
  image: string
  points: string[]
  gradingUpdateUrl: string
  gradingUpdateClaim: string | null
}

interface PendingGrading extends RemoteGradingRequest {
  submissionId: string
  sends: number
  nonces: string[]
  resendTimer: ReturnType<typeof setTimeout> | null
  isFinished: boolean
}

/** What `RemoteGradings` reaches the outside world through; tests pass fakes. */
export interface RemoteGradingsDeps {
  config: () => RemoteSandboxConfig
  dispatch: (task: SandboxTask, config: RemoteSandboxConfig) => Promise<DispatchResult>
  sendGradingUpdate: (
    url: string,
    claim: string | null,
    result: ExerciseTaskGradingResult,
  ) => Promise<void>
  now: () => number
}

/** Gradings handed to remote sandboxes whose results have not arrived yet. */
export class RemoteGradings {
  private readonly pendingByNonce = new Map<string, PendingGrading>()
  /** Nonce to the time it may be forgotten. */
  private readonly consumedNonces = new Map<string, number>()
  private pendingArchiveBytes = 0
  private readonly deps: RemoteGradingsDeps

  public constructor(deps: RemoteGradingsDeps) {
    this.deps = deps
  }

  /**
   * Hands a submission to a sandbox. Resolves to null when one accepted it, and the result will
   * come through `handleCallback`; otherwise to the `Failed` grading to report now.
   */
  public async start(request: RemoteGradingRequest): Promise<ExerciseTaskGradingResult | null> {
    if (this.pendingArchiveBytes + request.archive.length > MAX_PENDING_ARCHIVE_BYTES) {
      logger.error("Too many submission archives wait for a sandbox; failing this grading")
      return failedGradingResult("The grading servers are busy. Submit again later.", {
        feedback_key: "sandbox_busy",
      })
    }
    this.pendingArchiveBytes += request.archive.length
    const grading: PendingGrading = {
      ...request,
      submissionId: sandboxSubmissionId(request.gradingUpdateUrl),
      sends: 0,
      nonces: [],
      resendTimer: null,
      isFinished: false,
    }
    let failure: ExerciseTaskGradingResult | null
    try {
      failure = await this.send(grading)
    } catch (e) {
      this.finish(grading)
      throw e
    }
    // A send that timed out can still have run and called back, and its failure callback can
    // have started a later send that now owns the grading.
    if (!failure || grading.isFinished || grading.sends > 1) {
      return null
    }
    this.finish(grading)
    return failure
  }

  /**
   * Reports a sandbox's result for a token this service sealed. Returns false, doing nothing, for
   * a nonce whose result was already handled.
   */
  public handleCallback(payload: SandboxTokenPayload, outcome: CallbackOutcome): boolean {
    this.forgetExpiredNonces()
    if (this.consumedNonces.has(payload.nonce)) {
      return false
    }
    const grading = this.pendingByNonce.get(payload.nonce)
    let result: ExerciseTaskGradingResult
    if ("sandboxError" in outcome) {
      logger.error(`The sandbox failed to run a submission: ${outcome.sandboxError}`)
      // An older send failing says nothing about the newer one still running.
      const isOlderSend = grading !== undefined && grading.nonces.at(-1) !== payload.nonce
      if (grading && (isOlderSend || grading.sends < MAX_SENDS)) {
        this.consume(payload.nonce)
        if (!isOlderSend) {
          this.resendInBackground(grading)
        }
        return true
      }
      result = serverErrorResult()
    } else {
      try {
        result = gradingResultFromRun(outcome.run, payload.points)
      } catch (e) {
        logger.error("Could not grade a sandbox result", e)
        result = serverErrorResult()
      }
    }
    if (grading) {
      this.finish(grading)
    } else {
      this.consume(payload.nonce)
    }
    void this.deps.sendGradingUpdate(payload.url, payload.claim, result)
    return true
  }

  /** Dispatches once more; resolves to the failure to report when no sandbox took it. */
  private async send(grading: PendingGrading): Promise<ExerciseTaskGradingResult | null> {
    const nonce = newNonce()
    grading.sends++
    grading.nonces.push(nonce)
    this.pendingByNonce.set(nonce, grading)
    const config = this.deps.config()
    const payload: SandboxTokenPayload = {
      v: 1,
      url: grading.gradingUpdateUrl,
      claim: grading.gradingUpdateClaim,
      points: grading.points,
      nonce,
      exp: this.deps.now() + TOKEN_TTL_MS,
    }
    // oxlint-disable-next-line typescript/no-non-null-assertion -- config validation requires a key
    const token = sealToken(payload, config.tokenKeys[0]!)
    const dispatched = await this.deps.dispatch(
      {
        archive: grading.archive,
        image: grading.image,
        submissionId: grading.submissionId,
        token,
      },
      config,
    )
    if (!dispatched.accepted) {
      return dispatched.result
    }
    if (!grading.isFinished) {
      grading.resendTimer = setTimeout(() => {
        this.resendInBackground(grading)
      }, RESEND_AFTER_MS)
      grading.resendTimer.unref?.()
    }
    return null
  }

  private resendInBackground(grading: PendingGrading): void {
    this.resend(grading).catch((e: unknown) => {
      logger.error(`Failed to send submission ${grading.submissionId} again`, e)
      if (!grading.isFinished) {
        this.finish(grading)
        void this.deps.sendGradingUpdate(
          grading.gradingUpdateUrl,
          grading.gradingUpdateClaim,
          serverErrorResult(),
        )
      }
    })
  }

  private async resend(grading: PendingGrading): Promise<void> {
    if (grading.isFinished) {
      return
    }
    clearTimeout(grading.resendTimer ?? undefined)
    grading.resendTimer = null
    let failure: ExerciseTaskGradingResult | null
    if (grading.sends >= MAX_SENDS) {
      logger.error(
        `No result for submission ${grading.submissionId} after ${grading.sends.toString()} sends`,
      )
      failure = serverErrorResult()
    } else {
      logger.log(`Sending submission ${grading.submissionId} to a sandbox again`)
      failure = await this.send(grading)
    }
    if (failure && !grading.isFinished) {
      this.finish(grading)
      await this.deps.sendGradingUpdate(
        grading.gradingUpdateUrl,
        grading.gradingUpdateClaim,
        failure,
      )
    }
  }

  /** Drops a grading and makes every token it handed out a duplicate. */
  private finish(grading: PendingGrading): void {
    if (grading.isFinished) {
      return
    }
    grading.isFinished = true
    clearTimeout(grading.resendTimer ?? undefined)
    grading.resendTimer = null
    for (const nonce of grading.nonces) {
      this.pendingByNonce.delete(nonce)
      this.consume(nonce)
    }
    this.pendingArchiveBytes -= grading.archive.length
  }

  private consume(nonce: string): void {
    this.consumedNonces.set(nonce, this.deps.now() + CONSUMED_NONCE_TTL_MS)
  }

  private forgetExpiredNonces(): void {
    const now = this.deps.now()
    for (const [nonce, forgetAt] of this.consumedNonces) {
      if (forgetAt < now) {
        this.consumedNonces.delete(nonce)
      }
    }
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

/** The service's remote gradings, configured from the environment. */
export const remoteGradings = new RemoteGradings({
  config: remoteSandboxConfig,
  dispatch: (task, config) => dispatchToSandbox(task, config),
  sendGradingUpdate,
  now: Date.now,
})
