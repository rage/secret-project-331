import type { SubmissionSource } from "@/server/preparedSubmission"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"

/** A submission to grade on a remote sandbox, as kept between its sends. */
export interface RemoteGradingRequest {
  /** Fetched again for every resend, so no archive is kept between sends. */
  submission: SubmissionSource
  gradingUpdateUrl: string
  gradingUpdateClaim: string | null
}

/** A grading that has not finished. */
export interface StoredGrading {
  request: RemoteGradingRequest
  /** Names the task in the sandbox's logs. */
  submissionId: string
  /** When the grading started, Unix milliseconds. */
  createdAtMs: number
  sends: number
  /** The result being reported to the host, or null while the grading is still being sent. */
  outcome: ExerciseTaskGradingResult | null
}

/** A grading `claimDue` handed to one caller; `claim` must accompany its `beginSend`. */
export interface ClaimedGrading {
  id: string
  claim: number
}

/** What a callback for a nonce means for its grading. */
export type CallbackDecision =
  /** The nonce was already handled, or the grading has an outcome: do nothing. */
  | "duplicate"
  /** No grading is known for the nonce: report the result from the token. */
  | "unknown"
  /** An older send's sandbox failure while a newer send runs: do nothing. */
  | "ignored"
  /** A sandbox failure with sends left: the grading is due for a resend now. */
  | "resend"
  /** The callback's outcome is now the grading's: report it, then `finish`. */
  | "report"

/** A callback to decide on in `RemoteGradingStore.recordCallback`. */
export interface CallbackRecord {
  nonce: string
  isSandboxError: boolean
  maxSends: number
  nowMs: number
  /** Kept as the grading's outcome when the decision is `report`. */
  outcome: ExerciseTaskGradingResult
  reportLeaseUntilMs: number
}

/**
 * Remote-grading state shared by every process of the service. Each method is atomic, so
 * processes may call them on the same grading at once.
 *
 * A grading is sent until it gets an outcome (`settle` or a `report` callback), then reported
 * until `finish`. Either phase is leased: when the lease ends, `claimDue` hands it to a caller
 * again, which resends it or reports its outcome again.
 */
export interface RemoteGradingStore {
  /**
   * Records a new grading with claim 0, already sent once under `nonce` and leased until
   * `leaseUntilMs`, so a create that lands after the caller gave up on it matches that send.
   */
  create: (
    id: string,
    grading: Omit<StoredGrading, "sends" | "outcome">,
    nonce: string,
    leaseUntilMs: number,
  ) => Promise<void>
  /** The grading, or null once it has finished or expired. */
  get: (id: string) => Promise<StoredGrading | null>
  /**
   * Counts a send under `nonce`, making it the latest, and leases the grading until
   * `leaseUntilMs`. False unless the grading is still being sent and `claim` is its latest.
   */
  beginSend: (id: string, nonce: string, claim: number, leaseUntilMs: number) => Promise<boolean>
  /** Makes an accepted send due for a resend at `dueAtMs`, unless a later send or an outcome has taken over. */
  scheduleResend: (id: string, nonce: string, dueAtMs: number) => Promise<boolean>
  /**
   * Gives a grading that is still being sent its outcome, leased for reporting until
   * `reportLeaseUntilMs`. With `nonce`, only while that send is the latest. True for the one call
   * that set it.
   */
  settle: (
    id: string,
    outcome: ExerciseTaskGradingResult,
    reportLeaseUntilMs: number,
    nonce?: string,
  ) => Promise<boolean>
  /** Ends the grading once the host has its outcome; its other nonces become duplicates. */
  finish: (id: string) => Promise<void>
  /**
   * Consumes the callback's nonce and decides what the callback means. `gradingId` is null when
   * no grading is known for the nonce.
   */
  recordCallback: (
    callback: CallbackRecord,
  ) => Promise<{ decision: CallbackDecision; gradingId: string | null }>
  /** Keeps a grading this process is about to send from coming due, while it is still being sent. */
  renewLease: (id: string, leaseUntilMs: number) => Promise<void>
  /**
   * Gradings due by `nowMs`, at most `limit`, each leased until `leaseUntilMs` under a new claim,
   * which voids earlier claims on it.
   */
  claimDue: (nowMs: number, leaseUntilMs: number, limit: number) => Promise<ClaimedGrading[]>
}

/** How long gradings, their nonces and consumed nonces are kept: past any token's lifetime. */
export const STORE_TTL_MS = 2 * 60 * 60_000

interface MemoryGrading extends StoredGrading {
  latestNonce: string | null
  claim: number
  isFinished: boolean
  expiresAt: number
}

function decide(decision: CallbackDecision, gradingId: string | null = null) {
  return Promise.resolve({ decision, gradingId })
}

/** A `RemoteGradingStore` for one process, for tests. */
export class MemoryRemoteGradingStore implements RemoteGradingStore {
  private readonly gradings = new Map<string, MemoryGrading>()
  /** Outlived by its grading, so `live` covers both. */
  private readonly gradingByNonce = new Map<string, string>()
  private readonly consumedNonces = new Map<string, number>()
  private readonly due = new Map<string, number>()
  private readonly now: () => number

  public constructor(now: () => number) {
    this.now = now
  }

  public create(
    id: string,
    grading: Omit<StoredGrading, "sends" | "outcome">,
    nonce: string,
    leaseUntilMs: number,
  ) {
    this.gradings.set(id, {
      ...structuredClone(grading),
      sends: 1,
      outcome: null,
      latestNonce: nonce,
      claim: 0,
      isFinished: false,
      expiresAt: this.now() + STORE_TTL_MS,
    })
    this.gradingByNonce.set(nonce, id)
    this.due.set(id, leaseUntilMs)
    return Promise.resolve()
  }

  public get(id: string) {
    const grading = this.unfinished(id)
    if (!grading) {
      return Promise.resolve(null)
    }
    const { request, submissionId, createdAtMs, sends, outcome } = grading
    return Promise.resolve(structuredClone({ request, submissionId, createdAtMs, sends, outcome }))
  }

  public beginSend(id: string, nonce: string, claim: number, leaseUntilMs: number) {
    const grading = this.sending(id)
    if (!grading || grading.claim !== claim) {
      return Promise.resolve(false)
    }
    grading.sends++
    grading.latestNonce = nonce
    this.gradingByNonce.set(nonce, id)
    this.due.set(id, leaseUntilMs)
    return Promise.resolve(true)
  }

  public scheduleResend(id: string, nonce: string, dueAtMs: number) {
    const grading = this.sending(id)
    if (!grading || grading.latestNonce !== nonce || this.isConsumed(nonce)) {
      return Promise.resolve(false)
    }
    this.due.set(id, dueAtMs)
    return Promise.resolve(true)
  }

  public settle(
    id: string,
    outcome: ExerciseTaskGradingResult,
    reportLeaseUntilMs: number,
    nonce?: string,
  ) {
    const grading = this.sending(id)
    if (!grading || (nonce !== undefined && grading.latestNonce !== nonce)) {
      return Promise.resolve(false)
    }
    this.setOutcome(id, grading, outcome, reportLeaseUntilMs)
    return Promise.resolve(true)
  }

  public finish(id: string) {
    const grading = this.unfinished(id)
    if (grading) {
      grading.isFinished = true
      grading.expiresAt = this.now() + STORE_TTL_MS
    }
    this.due.delete(id)
    return Promise.resolve()
  }

  public recordCallback(callback: CallbackRecord) {
    const { nonce, isSandboxError, maxSends, nowMs, outcome, reportLeaseUntilMs } = callback
    if (this.isConsumed(nonce)) {
      return decide("duplicate")
    }
    this.consumedNonces.set(nonce, this.now() + STORE_TTL_MS)
    const id = this.gradingByNonce.get(nonce)
    const grading = id === undefined ? undefined : this.live(id)
    if (id === undefined || !grading) {
      return decide("unknown")
    }
    if (grading.isFinished || grading.outcome) {
      return decide("duplicate", id)
    }
    if (isSandboxError) {
      if (grading.latestNonce !== nonce) {
        return decide("ignored", id)
      }
      if (grading.sends < maxSends) {
        this.due.set(id, nowMs)
        return decide("resend", id)
      }
    }
    this.setOutcome(id, grading, outcome, reportLeaseUntilMs)
    return decide("report", id)
  }

  public renewLease(id: string, leaseUntilMs: number) {
    if (this.sending(id)) {
      this.due.set(id, leaseUntilMs)
    }
    return Promise.resolve()
  }

  public claimDue(nowMs: number, leaseUntilMs: number, limit: number) {
    const ids = [...this.due]
      .filter(([, dueAt]) => dueAt <= nowMs)
      .toSorted(([, a], [, b]) => a - b)
      .slice(0, limit)
      .map(([id]) => id)
    const claimed: ClaimedGrading[] = []
    for (const id of ids) {
      const grading = this.unfinished(id)
      if (!grading) {
        this.due.delete(id)
        continue
      }
      grading.claim++
      this.due.set(id, leaseUntilMs)
      claimed.push({ id, claim: grading.claim })
    }
    return Promise.resolve(claimed)
  }

  private setOutcome(
    id: string,
    grading: MemoryGrading,
    outcome: ExerciseTaskGradingResult,
    reportLeaseUntilMs: number,
  ) {
    grading.outcome = structuredClone(outcome)
    grading.claim++
    this.due.set(id, reportLeaseUntilMs)
  }

  private live(id: string): MemoryGrading | undefined {
    const grading = this.gradings.get(id)
    if (grading && grading.expiresAt <= this.now()) {
      this.gradings.delete(id)
      return undefined
    }
    return grading
  }

  private unfinished(id: string): MemoryGrading | undefined {
    const grading = this.live(id)
    return grading && !grading.isFinished ? grading : undefined
  }

  /** The grading while it is still being sent: unfinished and without an outcome. */
  private sending(id: string): MemoryGrading | undefined {
    const grading = this.unfinished(id)
    return grading && !grading.outcome ? grading : undefined
  }

  private isConsumed(nonce: string): boolean {
    const forgetAt = this.consumedNonces.get(nonce)
    return forgetAt !== undefined && forgetAt > this.now()
  }
}
