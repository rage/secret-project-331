import { Redis } from "ioredis"

import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import { createLogger } from "@/util/logger"

import type {
  CallbackDecision,
  CallbackRecord,
  ClaimedGrading,
  RemoteGradingRequest,
  RemoteGradingStore,
  StoredGrading,
} from "./gradingStore"
import { STORE_TTL_MS } from "./gradingStore"

const logger = createLogger("remote-sandbox")

/** Every key this service writes starts with this; headless-lms shares the Redis server. */
export const REDIS_KEY_PREFIX = "tmc:remote-sandbox:"

/** Bounds how long a grading or a callback waits on an unreachable Redis. */
const REDIS_COMMAND_TIMEOUT_MS = 5_000

/** A Redis client that fails commands within seconds instead of queueing them through an outage. */
export function connectRedis(url: string): Redis {
  const client = new Redis(url, {
    commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
    connectTimeout: REDIS_COMMAND_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
  })
  client.on("error", (e: unknown) => {
    logger.error("Redis connection error", e)
  })
  return client
}

// A missing hash reads `finished` as false, so it counts as finished. Scripts that build grading
// keys from ids are fine on the standalone Redis this runs against, not on Redis Cluster.
const PRELUDE = `
local function sending(key)
  return redis.call('HGET', key, 'finished') == '0' and redis.call('HEXISTS', key, 'outcome') == 0
end
local function set_outcome(key, due, outcome, lease_until, id)
  redis.call('HSET', key, 'outcome', outcome)
  redis.call('HINCRBY', key, 'claim', 1)
  redis.call('ZADD', due, lease_until, id)
end`

/** KEYS: grading, nonce, due. ARGV: nonce, id, ttl, leaseUntil, claim. */
const BEGIN_SEND = `${PRELUDE}
if not sending(KEYS[1]) or redis.call('HGET', KEYS[1], 'claim') ~= ARGV[5] then return 0 end
redis.call('HINCRBY', KEYS[1], 'sends', 1)
redis.call('HSET', KEYS[1], 'latestNonce', ARGV[1])
redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])
redis.call('ZADD', KEYS[3], ARGV[4], ARGV[2])
return 1`

/** KEYS: grading, consumed nonce, due. ARGV: nonce, dueAt, id. */
const SCHEDULE_RESEND = `${PRELUDE}
if not sending(KEYS[1])
  or redis.call('HGET', KEYS[1], 'latestNonce') ~= ARGV[1]
  or redis.call('EXISTS', KEYS[2]) == 1 then
  return 0
end
redis.call('ZADD', KEYS[3], ARGV[2], ARGV[3])
return 1`

/** KEYS: grading, due. ARGV: outcome, leaseUntil, id, nonce or ''. */
const SETTLE = `${PRELUDE}
if not sending(KEYS[1]) then return 0 end
if ARGV[4] ~= '' and redis.call('HGET', KEYS[1], 'latestNonce') ~= ARGV[4] then return 0 end
set_outcome(KEYS[1], KEYS[2], ARGV[1], ARGV[2], ARGV[3])
return 1`

/** KEYS: grading, due. ARGV: ttl, id. */
const FINISH = `
if redis.call('HGET', KEYS[1], 'finished') == '0' then
  redis.call('HSET', KEYS[1], 'finished', '1')
  redis.call('HDEL', KEYS[1], 'request', 'outcome')
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
redis.call('ZREM', KEYS[2], ARGV[2])`

/**
 * KEYS: consumed nonce, nonce, due.
 * ARGV: ttl, grading key prefix, nonce, isSandboxError, maxSends, now, outcome, reportLeaseUntil.
 * Builds the grading key from the nonce's id; returns the decision and that id, or ''.
 */
const RECORD_CALLBACK = `${PRELUDE}
local function decide()
  if not redis.call('SET', KEYS[1], '1', 'NX', 'PX', ARGV[1]) then return 'duplicate', '' end
  local id = redis.call('GET', KEYS[2])
  if not id then return 'unknown', '' end
  local key = ARGV[2] .. id
  local state = redis.call('HMGET', key, 'finished', 'latestNonce', 'sends')
  if not state[1] then return 'unknown', '' end
  if not sending(key) then return 'duplicate', id end
  if ARGV[4] == '1' then
    if state[2] ~= ARGV[3] then return 'ignored', id end
    if tonumber(state[3]) < tonumber(ARGV[5]) then
      redis.call('ZADD', KEYS[3], ARGV[6], id)
      return 'resend', id
    end
  end
  set_outcome(key, KEYS[3], ARGV[7], ARGV[8], id)
  return 'report', id
end
local decision, id = decide()
return {decision, id}`

/** KEYS: grading, due. ARGV: leaseUntil, id. */
const RENEW_LEASE = `${PRELUDE}
if sending(KEYS[1]) then redis.call('ZADD', KEYS[2], ARGV[1], ARGV[2]) end`

/** KEYS: due. ARGV: now, leaseUntil, limit, grading key prefix. Returns id, claim pairs flattened. */
const CLAIM_DUE = `
local ids = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[3])
local claimed = {}
for _, id in ipairs(ids) do
  local key = ARGV[4] .. id
  if redis.call('HGET', key, 'finished') == '0' then
    redis.call('ZADD', KEYS[1], ARGV[2], id)
    table.insert(claimed, id)
    table.insert(claimed, redis.call('HINCRBY', key, 'claim', 1))
  else
    redis.call('ZREM', KEYS[1], id)
  end
end
return claimed`

/** The `RemoteGradingStore` shared by the service's processes. */
export class RedisRemoteGradingStore implements RemoteGradingStore {
  private readonly redis: Redis
  private readonly prefix: string
  private readonly dueKey: string

  /** `prefix` namespaces the keys; tests pass their own. */
  public constructor(redis: Redis, prefix: string = REDIS_KEY_PREFIX) {
    this.redis = redis
    this.prefix = prefix
    this.dueKey = `${prefix}due`
  }

  public async create(
    id: string,
    grading: Omit<StoredGrading, "sends" | "outcome">,
    dueAtMs: number,
  ) {
    const results = await this.redis
      .multi()
      .hset(this.gradingKey(id), {
        request: JSON.stringify(grading.request),
        submissionId: grading.submissionId,
        createdAt: grading.createdAtMs,
        sends: 0,
        claim: 0,
        finished: 0,
      })
      .pexpire(this.gradingKey(id), STORE_TTL_MS)
      .zadd(this.dueKey, dueAtMs, id)
      .exec()
    const failure = results?.find(([e]) => e)?.[0]
    if (failure) {
      throw failure
    }
  }

  public async get(id: string): Promise<StoredGrading | null> {
    const [
      request = null,
      submissionId = null,
      createdAt = null,
      sends = null,
      finished = null,
      outcome = null,
    ] = await this.redis.hmget(
      this.gradingKey(id),
      "request",
      "submissionId",
      "createdAt",
      "sends",
      "finished",
      "outcome",
    )
    if (
      finished !== "0" ||
      request === null ||
      submissionId === null ||
      createdAt === null ||
      sends === null
    ) {
      return null
    }
    return {
      request: JSON.parse(request) as RemoteGradingRequest,
      submissionId,
      createdAtMs: Number(createdAt),
      sends: Number(sends),
      outcome: outcome === null ? null : (JSON.parse(outcome) as ExerciseTaskGradingResult),
    }
  }

  public async beginSend(id: string, nonce: string, claim: number, leaseUntilMs: number) {
    const began = await this.redis.eval(
      BEGIN_SEND,
      3,
      this.gradingKey(id),
      this.nonceKey(nonce),
      this.dueKey,
      nonce,
      id,
      STORE_TTL_MS,
      leaseUntilMs,
      claim,
    )
    return began === 1
  }

  public async scheduleResend(id: string, nonce: string, dueAtMs: number) {
    const scheduled = await this.redis.eval(
      SCHEDULE_RESEND,
      3,
      this.gradingKey(id),
      this.consumedKey(nonce),
      this.dueKey,
      nonce,
      dueAtMs,
      id,
    )
    return scheduled === 1
  }

  public async settle(
    id: string,
    outcome: ExerciseTaskGradingResult,
    reportLeaseUntilMs: number,
    nonce?: string,
  ) {
    const settled = await this.redis.eval(
      SETTLE,
      2,
      this.gradingKey(id),
      this.dueKey,
      JSON.stringify(outcome),
      reportLeaseUntilMs,
      id,
      nonce ?? "",
    )
    return settled === 1
  }

  public async finish(id: string) {
    await this.redis.eval(FINISH, 2, this.gradingKey(id), this.dueKey, STORE_TTL_MS, id)
  }

  public async recordCallback(callback: CallbackRecord) {
    const { nonce, isSandboxError, maxSends, nowMs, outcome, reportLeaseUntilMs } = callback
    const [decision, gradingId] = (await this.redis.eval(
      RECORD_CALLBACK,
      3,
      this.consumedKey(nonce),
      this.nonceKey(nonce),
      this.dueKey,
      STORE_TTL_MS,
      this.gradingKey(""),
      nonce,
      isSandboxError ? "1" : "0",
      maxSends,
      nowMs,
      JSON.stringify(outcome),
      reportLeaseUntilMs,
    )) as [CallbackDecision, string]
    return { decision, gradingId: gradingId === "" ? null : gradingId }
  }

  public async renewLease(id: string, leaseUntilMs: number) {
    await this.redis.eval(RENEW_LEASE, 2, this.gradingKey(id), this.dueKey, leaseUntilMs, id)
  }

  public async claimDue(nowMs: number, leaseUntilMs: number, limit: number) {
    const flat = (await this.redis.eval(
      CLAIM_DUE,
      1,
      this.dueKey,
      nowMs,
      leaseUntilMs,
      limit,
      this.gradingKey(""),
    )) as (string | number)[]
    const claimed: ClaimedGrading[] = []
    for (let i = 0; i + 1 < flat.length; i += 2) {
      claimed.push({ id: String(flat[i]), claim: Number(flat[i + 1]) })
    }
    return claimed
  }

  private gradingKey(id: string) {
    return `${this.prefix}grading:${id}`
  }

  private nonceKey(nonce: string) {
    return `${this.prefix}nonce:${nonce}`
  }

  private consumedKey(nonce: string) {
    return `${this.prefix}consumed:${nonce}`
  }
}
