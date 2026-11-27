// @vitest-environment node
import type { Mock } from "vitest"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { SubmissionSource } from "@/server/preparedSubmission"

import type { CallbackOutcome } from "./callback"
import type { RemoteSandboxConfig } from "./config"
import type { DispatchResult, SandboxTask } from "./dispatch"
import type { RemoteGradingRequest, RemoteGradingStore } from "./gradingStore"
import type { RemoteGradingsDeps, SandboxSubmission } from "./remoteGradings"
import { RemoteGradings, sandboxSubmissionId } from "./remoteGradings"
import { storeFactories } from "./testStores"
import type { SandboxTokenPayload } from "./token"
import { openToken } from "./token"

const CONFIG: RemoteSandboxConfig = {
  servers: [{ baseUrl: "http://sandbox", authorization: null }],
  notifyUrl: "http://tmc/api/sandbox-results",
  notifySecret: null,
  tokenKeys: [Buffer.alloc(32, 1)],
  redisUrl: "redis://localhost",
}

const REQUEST: RemoteGradingRequest = {
  submission: {
    answer: { name: "answer.tar.zst", mime: "application/zstd", downloadUrl: "http://lms/answer" },
    templateDownloadUrl: "http://lms/template",
  },
  gradingUpdateUrl: "http://lms/api/v0/exercise-services/grading/grading-update/sub-1",
  gradingUpdateClaim: "claim",
}

const SUBMISSION: SandboxSubmission = {
  archive: Buffer.from("archive"),
  image: "eu.gcr.io/moocfi-public/tmc-sandbox-python:latest",
  points: ["1.1"],
}

const PASSED: CallbackOutcome = {
  run: {
    timedOut: false,
    output: "",
    parsed: {
      status: "PASSED",
      testResults: [{ name: "t", successful: true, points: ["1.1"], message: "", exception: [] }],
      logs: {},
    },
    validations: null,
  },
}

const SANDBOX_ERROR: CallbackOutcome = { sandboxError: "docker pull failed" }

const BUSY: DispatchResult = {
  accepted: false,
  result: {
    grading_progress: "Failed",
    score_given: 0,
    score_maximum: 0,
    feedback_text: "busy",
    feedback_json: { feedback_key: "sandbox_busy" },
  },
}

const MINUTE = 60_000

/** Lets background sends started by a callback run to completion. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
  }
}

/**
 * `inner` with an outage switch: while `state.isDown`, every call fails at once, or like a
 * client's command timeout, after a while.
 */
function withOutage(inner: RemoteGradingStore, failure: "fails" | "times out" = "fails") {
  const state = { isDown: false }
  const store = new Proxy(inner, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver)
      if (typeof value !== "function") {
        return value
      }
      return (...args: unknown[]): unknown => {
        if (!state.isDown) {
          return (value as (...a: unknown[]) => unknown).apply(target, args)
        }
        const error = new Error(failure === "fails" ? "ECONNREFUSED" : "Command timed out")
        return failure === "fails"
          ? Promise.reject(error)
          : new Promise((_, reject) => {
              setTimeout(() => {
                reject(error)
              }, 20)
            })
      }
    },
  })
  return { state, store }
}

for (const factory of storeFactories()) {
  describe(`RemoteGradings with the ${factory.name} store`, () => {
    let nowMs: number
    let sentTasks: SandboxTask[]
    let prepared: SubmissionSource[]
    let dispatch: Mock<RemoteGradingsDeps["dispatch"]>
    let prepare: Mock<(submission: SubmissionSource) => Promise<SandboxSubmission>>
    let sendGradingUpdate: Mock<RemoteGradingsDeps["sendGradingUpdate"]>
    let gradings: RemoteGradings

    function store(): RemoteGradingStore {
      return factory.store(() => nowMs)
    }

    /** Another process of the service, over the same store unless given another. */
    function startProcess(processStore: RemoteGradingStore = store()): RemoteGradings {
      return new RemoteGradings({
        store: processStore,
        config: () => CONFIG,
        prepare: async (submission, run) => run(await prepare(submission)),
        dispatch,
        sendGradingUpdate,
        now: () => nowMs,
      })
    }

    beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => {})
      vi.spyOn(console, "warn").mockImplementation(() => {})
      vi.spyOn(console, "error").mockImplementation(() => {})
      nowMs = Date.now()
      sentTasks = []
      prepared = []
      dispatch = vi.fn<RemoteGradingsDeps["dispatch"]>((task) => {
        sentTasks.push(task)
        return Promise.resolve({ accepted: true })
      })
      prepare = vi.fn((submission: SubmissionSource) => {
        prepared.push(submission)
        return Promise.resolve(SUBMISSION)
      })
      sendGradingUpdate = vi.fn<RemoteGradingsDeps["sendGradingUpdate"]>(() =>
        Promise.resolve(true),
      )
      gradings = startProcess()
    })

    afterEach(async () => {
      vi.restoreAllMocks()
      await factory.reset()
    })

    afterAll(async () => {
      await factory.close()
    })

    function tokenOf(send: number): SandboxTokenPayload {
      const task = sentTasks[send]
      const payload = task && openToken(task.token, CONFIG.tokenKeys, Date.now())
      if (!payload) {
        throw new Error(`no token for send ${send.toString()}`)
      }
      return payload
    }

    async function after(ms: number, sweeper: RemoteGradings = gradings): Promise<void> {
      await sweeper.drain()
      nowMs += ms
      await sweeper.sweep()
    }

    it("reports the sandbox's result to the grading-update URL in the token", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      const token = tokenOf(0)
      expect(token).toMatchObject({
        url: REQUEST.gradingUpdateUrl,
        claim: "claim",
        points: ["1.1"],
      })
      expect(sentTasks[0]?.submissionId).toBe("cmf-sub-1")

      expect(await gradings.handleCallback(token, PASSED)).toBe(true)
      expect(sendGradingUpdate).toHaveBeenCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({ grading_progress: "FullyGraded", score_given: 1 }),
      )
    })

    it("ignores a repeated callback", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      const token = tokenOf(0)
      await gradings.handleCallback(token, PASSED)
      expect(await gradings.handleCallback(token, PASSED)).toBe(false)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
    })

    it("reports a result whose grading the store does not know", async () => {
      const token: SandboxTokenPayload = {
        v: 1,
        url: "http://lms/grading-update/other",
        claim: null,
        points: ["1.1"],
        nonce: "unknown",
        exp: Date.now() + MINUTE,
      }
      expect(await gradings.handleCallback(token, PASSED)).toBe(true)
      expect(sendGradingUpdate).toHaveBeenCalledWith(
        "http://lms/grading-update/other",
        null,
        expect.objectContaining({ grading_progress: "FullyGraded" }),
      )
    })

    it("resends a task with no result every 5 minutes and fails it after 3 sends", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      await after(5 * MINUTE - 1)
      expect(sentTasks).toHaveLength(1)
      await after(1)
      expect(sentTasks).toHaveLength(2)
      expect(tokenOf(1).nonce).not.toBe(tokenOf(0).nonce)
      await after(5 * MINUTE)
      expect(sentTasks).toHaveLength(3)
      expect(sendGradingUpdate).not.toHaveBeenCalled()
      await after(5 * MINUTE)
      expect(sentTasks).toHaveLength(3)
      expect(sendGradingUpdate).toHaveBeenCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({
          grading_progress: "Failed",
          feedback_json: { feedback_key: "server_error" },
        }),
      )
    })

    it("downloads and prepares the submission again for each resend", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      expect(prepare).not.toHaveBeenCalled()
      await after(5 * MINUTE)
      expect(prepared).toEqual([REQUEST.submission])
      expect(sentTasks[1]?.archive).toEqual(SUBMISSION.archive)
    })

    it("fails the grading when a resend cannot download the submission", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      prepare.mockRejectedValueOnce(new Error("Download failed: 403 Forbidden"))
      await after(5 * MINUTE)
      expect(sentTasks).toHaveLength(1)
      expect(sendGradingUpdate).toHaveBeenCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({ feedback_json: { feedback_key: "server_error" } }),
      )
      await after(30 * MINUTE)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
    })

    it("takes a late result from an earlier send and ignores the resent task's", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      await after(5 * MINUTE)
      expect(sentTasks).toHaveLength(2)
      expect(await gradings.handleCallback(tokenOf(0), PASSED)).toBe(true)
      expect(await gradings.handleCallback(tokenOf(1), PASSED)).toBe(false)
      await after(30 * MINUTE)
      expect(sentTasks).toHaveLength(2)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
    })

    it("resends at once when the sandbox fails to run the task, until out of sends", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      expect(await gradings.handleCallback(tokenOf(0), SANDBOX_ERROR)).toBe(true)
      await vi.waitFor(() => {
        expect(sentTasks).toHaveLength(2)
      })
      await gradings.handleCallback(tokenOf(1), SANDBOX_ERROR)
      await vi.waitFor(() => {
        expect(sentTasks).toHaveLength(3)
      })
      expect(sendGradingUpdate).not.toHaveBeenCalled()
      await gradings.handleCallback(tokenOf(2), SANDBOX_ERROR)
      expect(sendGradingUpdate).toHaveBeenCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({ feedback_json: { feedback_key: "server_error" } }),
      )
    })

    it("does not resend when an older send fails while a newer one runs", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      await after(5 * MINUTE)
      expect(sentTasks).toHaveLength(2)
      expect(await gradings.handleCallback(tokenOf(0), SANDBOX_ERROR)).toBe(true)
      await settle()
      expect(sentTasks).toHaveLength(2)
      expect(await gradings.handleCallback(tokenOf(1), PASSED)).toBe(true)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
    })

    it("keeps a resend's result when the first dispatch fails after the resend was accepted", async () => {
      let failFirstDispatch: ((result: DispatchResult) => void) | undefined
      dispatch.mockImplementationOnce((task) => {
        sentTasks.push(task)
        return new Promise((resolve) => {
          failFirstDispatch = resolve
        })
      })
      const started = gradings.start(REQUEST, SUBMISSION)
      await vi.waitFor(() => {
        expect(sentTasks).toHaveLength(1)
      })
      await gradings.handleCallback(tokenOf(0), SANDBOX_ERROR)
      await vi.waitFor(() => {
        expect(sentTasks).toHaveLength(2)
      })
      failFirstDispatch?.(BUSY)
      await started
      expect(await gradings.handleCallback(tokenOf(1), PASSED)).toBe(true)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
      expect(sendGradingUpdate).toHaveBeenCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({ grading_progress: "FullyGraded" }),
      )
    })

    it("fails the grading when a resend throws", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      dispatch.mockRejectedValueOnce(new Error("boom"))
      await after(5 * MINUTE)
      expect(sendGradingUpdate).toHaveBeenCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({ feedback_json: { feedback_key: "server_error" } }),
      )
    })

    it("reports the dispatch failure and keeps nothing pending", async () => {
      dispatch.mockResolvedValueOnce(BUSY)
      await gradings.start(REQUEST, SUBMISSION)
      expect(sendGradingUpdate).toHaveBeenCalledWith(REQUEST.gradingUpdateUrl, "claim", BUSY.result)
      await after(30 * MINUTE)
      expect(dispatch).toHaveBeenCalledTimes(1)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
    })

    it("does not report a dispatch failure once a callback has the grading's result", async () => {
      let failDispatch: ((result: DispatchResult) => void) | undefined
      dispatch.mockImplementationOnce((task) => {
        sentTasks.push(task)
        return new Promise((resolve) => {
          failDispatch = resolve
        })
      })
      const started = gradings.start(REQUEST, SUBMISSION)
      await vi.waitFor(() => {
        expect(sentTasks).toHaveLength(1)
      })
      await gradings.handleCallback(tokenOf(0), PASSED)
      failDispatch?.(BUSY)
      await started
      await gradings.drain()
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
      expect(sendGradingUpdate).toHaveBeenCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({ grading_progress: "FullyGraded" }),
      )
    })

    it("reports again until the host takes the update", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      sendGradingUpdate.mockResolvedValueOnce(false)
      await gradings.handleCallback(tokenOf(0), PASSED)
      await after(5 * MINUTE)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(2)
      expect(sendGradingUpdate).toHaveBeenLastCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({ grading_progress: "FullyGraded" }),
      )
      await after(30 * MINUTE)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(2)
      expect(sentTasks).toHaveLength(1)
    })

    it("reports a failure out of sends again after the reporting process stops", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      await after(5 * MINUTE)
      await after(5 * MINUTE)
      sendGradingUpdate.mockReturnValueOnce(new Promise(() => {}))
      nowMs += 5 * MINUTE
      void gradings.sweep()
      await vi.waitFor(() => {
        expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
      })
      const restarted = startProcess()
      await after(5 * MINUTE, restarted)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(2)
      expect(sendGradingUpdate).toHaveBeenLastCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({ feedback_json: { feedback_key: "server_error" } }),
      )
      expect(sentTasks).toHaveLength(3)
    })

    it("drops a queued resend once a callback brings the grading's result", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      let releaseSlot: (() => void) | undefined
      const slot = new Promise<void>((resolve) => {
        releaseSlot = resolve
      })
      prepare.mockImplementationOnce(async () => {
        await slot
        return SUBMISSION
      })
      nowMs += 5 * MINUTE
      const queued = gradings.sweep()
      await vi.waitFor(() => {
        expect(prepare).toHaveBeenCalledTimes(1)
      })
      await gradings.handleCallback(tokenOf(0), PASSED)
      releaseSlot?.()
      await queued
      expect(sentTasks).toHaveLength(1)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
    })

    it("fails as a server error when the result is not a tmc-langs run result", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      await gradings.handleCallback(tokenOf(0), {
        run: { timedOut: false, output: "", parsed: { nope: 1 }, validations: null },
      })
      expect(sendGradingUpdate).toHaveBeenCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({ feedback_json: { feedback_key: "server_error" } }),
      )
    })

    it("resends from another process after the dispatching one stops", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      const restarted = startProcess()
      await after(5 * MINUTE, restarted)
      expect(sentTasks).toHaveLength(2)
      expect(await restarted.handleCallback(tokenOf(1), PASSED)).toBe(true)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
      await after(30 * MINUTE, restarted)
      expect(sentTasks).toHaveLength(2)
    })

    it("resends at once from another process when the sandbox fails to run the task", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      const restarted = startProcess()
      await restarted.handleCallback(tokenOf(0), SANDBOX_ERROR)
      await vi.waitFor(() => {
        expect(sentTasks).toHaveLength(2)
      })
      expect(sendGradingUpdate).not.toHaveBeenCalled()
    })

    it("ignores a callback another process already handled", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      expect(await startProcess().handleCallback(tokenOf(0), PASSED)).toBe(true)
      expect(await gradings.handleCallback(tokenOf(0), PASSED)).toBe(false)
      await after(30 * MINUTE)
      expect(sentTasks).toHaveLength(1)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
    })

    it("resends a due grading from only one of two sweeping processes", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      const other = startProcess()
      nowMs += 5 * MINUTE
      await Promise.all([gradings.sweep(), other.sweep()])
      expect(sentTasks).toHaveLength(2)
    })

    it("reports a result again after the process reporting it stops", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      sendGradingUpdate.mockReturnValueOnce(new Promise(() => {}))
      await gradings.handleCallback(tokenOf(0), PASSED)
      const restarted = startProcess()
      await after(5 * MINUTE, restarted)
      expect(sentTasks).toHaveLength(1)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(2)
      expect(sendGradingUpdate).toHaveBeenLastCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({ grading_progress: "FullyGraded" }),
      )
    })

    it("keeps a resend waiting for a slot from being sent by another process too", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      let releaseSlot: (() => void) | undefined
      const slot = new Promise<void>((resolve) => {
        releaseSlot = resolve
      })
      prepare.mockImplementationOnce(async () => {
        await slot
        return SUBMISSION
      })
      nowMs += 5 * MINUTE
      const queued = gradings.sweep()
      await vi.waitFor(() => {
        expect(prepare).toHaveBeenCalledTimes(1)
      })
      nowMs += 19 * MINUTE
      await gradings.sweep()
      nowMs += 5 * MINUTE
      await startProcess().sweep()
      expect(prepare).toHaveBeenCalledTimes(1)
      releaseSlot?.()
      await queued
      expect(sentTasks).toHaveLength(2)
    })

    it("keeps an accepted grading when its resend cannot be scheduled", async () => {
      const flaky = store()
      vi.spyOn(flaky, "scheduleResend").mockRejectedValueOnce(new Error("timeout"))
      const flakyGradings = startProcess(flaky)
      await flakyGradings.start(REQUEST, SUBMISSION)
      expect(await flakyGradings.handleCallback(tokenOf(0), PASSED)).toBe(true)
      expect(sendGradingUpdate).toHaveBeenCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({ grading_progress: "FullyGraded" }),
      )
    })

    it("drops a grading the host has given up on instead of sending it again", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      await after(61 * MINUTE)
      await after(30 * MINUTE)
      expect(sentTasks).toHaveLength(1)
      expect(sendGradingUpdate).not.toHaveBeenCalled()
    })

    it("leaves a grading to its lease when settling a dispatch failure fails", async () => {
      const flaky = store()
      vi.spyOn(flaky, "settle").mockRejectedValueOnce(new Error("timeout"))
      const flakyGradings = startProcess(flaky)
      dispatch.mockResolvedValueOnce(BUSY)
      await flakyGradings.start(REQUEST, SUBMISSION)
      expect(sendGradingUpdate).not.toHaveBeenCalled()
      await after(20 * MINUTE, flakyGradings)
      expect(dispatch).toHaveBeenCalledTimes(2)
    })

    it.each(["fails", "times out"] as const)(
      "sends a grading untracked when the store %s, and reports its result",
      async (failure) => {
        const outage = withOutage(store(), failure)
        const broken = startProcess(outage.store)
        outage.state.isDown = true
        await broken.start(REQUEST, SUBMISSION)
        expect(dispatch).toHaveBeenCalledTimes(1)
        expect(console.warn).toHaveBeenCalledWith(
          "[remote-sandbox]",
          expect.stringContaining("sending it untracked"),
          expect.any(Error),
        )
        expect(await broken.handleCallback(tokenOf(0), PASSED)).toBe(true)
        await broken.drain()
        expect(sendGradingUpdate).toHaveBeenCalledWith(
          REQUEST.gradingUpdateUrl,
          "claim",
          expect.objectContaining({ grading_progress: "FullyGraded", score_given: 1 }),
        )
      },
    )

    it("reports an untracked grading's result once the store is back", async () => {
      const outage = withOutage(store())
      const broken = startProcess(outage.store)
      outage.state.isDown = true
      await broken.start(REQUEST, SUBMISSION)
      outage.state.isDown = false
      expect(await broken.handleCallback(tokenOf(0), PASSED)).toBe(true)
      await broken.drain()
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
      await after(30 * MINUTE, broken)
      expect(sentTasks).toHaveLength(1)
    })

    it("reports an untracked grading's dispatch failure", async () => {
      const outage = withOutage(store())
      const broken = startProcess(outage.store)
      outage.state.isDown = true
      dispatch.mockResolvedValueOnce(BUSY)
      await broken.start(REQUEST, SUBMISSION)
      await broken.drain()
      expect(sendGradingUpdate).toHaveBeenCalledWith(REQUEST.gradingUpdateUrl, "claim", BUSY.result)
    })

    it("matches a grading whose create failed after it landed to the send", async () => {
      const late = store()
      const create = late.create.bind(late)
      vi.spyOn(late, "create").mockImplementationOnce(async (...args) => {
        await create(...args)
        throw new Error("Command timed out")
      })
      const lateGradings = startProcess(late)
      await lateGradings.start(REQUEST, SUBMISSION)
      expect(await lateGradings.handleCallback(tokenOf(0), PASSED)).toBe(true)
      await lateGradings.drain()
      expect(await lateGradings.handleCallback(tokenOf(0), PASSED)).toBe(false)
      await after(30 * MINUTE, lateGradings)
      expect(sentTasks).toHaveLength(1)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
    })

    it("does not resend an untracked grading whose create landed after its dispatch failed", async () => {
      const late = store()
      const create = late.create.bind(late)
      vi.spyOn(late, "create").mockImplementationOnce(async (...args) => {
        await create(...args)
        throw new Error("Command timed out")
      })
      const lateGradings = startProcess(late)
      dispatch.mockResolvedValueOnce(BUSY)
      await lateGradings.start(REQUEST, SUBMISSION)
      await after(30 * MINUTE, lateGradings)
      expect(dispatch).toHaveBeenCalledTimes(1)
      expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
      expect(sendGradingUpdate).toHaveBeenCalledWith(REQUEST.gradingUpdateUrl, "claim", BUSY.result)
    })

    it("keeps sweeping through a store outage and resends once the store is back", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
      const outage = withOutage(store())
      const sweeping = startProcess(outage.store)
      await sweeping.start(REQUEST, SUBMISSION)
      const stop = sweeping.startSweeping()
      try {
        outage.state.isDown = true
        nowMs += 5 * MINUTE
        for (let i = 0; i < 5; i++) {
          await vi.advanceTimersByTimeAsync(20_000)
          await sweeping.drain()
        }
        expect(sentTasks).toHaveLength(1)
        expect(console.error).toHaveBeenCalledTimes(1)
        outage.state.isDown = false
        await vi.advanceTimersByTimeAsync(20_000)
        await sweeping.drain()
        expect(sentTasks).toHaveLength(2)
      } finally {
        stop()
        vi.useRealTimers()
      }
    })

    it("reports a result unchecked when the store is unreachable at callback time", async () => {
      await gradings.start(REQUEST, SUBMISSION)
      const unreachable = store()
      vi.spyOn(unreachable, "recordCallback").mockRejectedValue(new Error("ECONNREFUSED"))
      const broken = startProcess(unreachable)
      expect(await broken.handleCallback(tokenOf(0), PASSED)).toBe(true)
      expect(sendGradingUpdate).toHaveBeenCalledWith(
        REQUEST.gradingUpdateUrl,
        "claim",
        expect.objectContaining({ grading_progress: "FullyGraded" }),
      )
    })
  })
}

describe("sandboxSubmissionId", () => {
  it("names the host's submission", () => {
    expect(
      sandboxSubmissionId(
        "https://courses.mooc.fi/api/v0/exercise-services/grading/grading-update/0b0d6c7e-6a4e-4b8e-9e43-2c7f3f1d3a10",
      ),
    ).toBe("cmf-0b0d6c7e-6a4e-4b8e-9e43-2c7f3f1d3a10")
  })

  it("falls back to a random id the sandbox accepts", () => {
    expect(sandboxSubmissionId("not a url")).toMatch(/^cmf-[0-9a-f-]{36}$/)
    expect(sandboxSubmissionId("http://x/grading-update/a.b")).toMatch(/^cmf-[0-9a-f-]{36}$/)
  })
})
