// @vitest-environment node
import type { Mock } from "vitest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { CallbackOutcome } from "./callback"
import type { RemoteSandboxConfig } from "./config"
import type { DispatchResult, SandboxTask } from "./dispatch"
import type { RemoteGradingRequest, RemoteGradingsDeps } from "./remoteGradings"
import { RemoteGradings, sandboxSubmissionId } from "./remoteGradings"
import type { SandboxTokenPayload } from "./token"
import { openToken } from "./token"

const CONFIG: RemoteSandboxConfig = {
  servers: [{ baseUrl: "http://sandbox", authorization: null }],
  notifyUrl: "http://tmc/api/sandbox-results",
  notifySecret: null,
  tokenKeys: [Buffer.alloc(32, 1)],
}

const REQUEST: RemoteGradingRequest = {
  archive: Buffer.from("archive"),
  image: "eu.gcr.io/moocfi-public/tmc-sandbox-python:latest",
  points: ["1.1"],
  gradingUpdateUrl: "http://lms/api/v0/exercise-services/grading/grading-update/sub-1",
  gradingUpdateClaim: "claim",
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

const MINUTE = 60_000

let sentTasks: SandboxTask[]
let dispatchResult: DispatchResult
let sendGradingUpdate: Mock<RemoteGradingsDeps["sendGradingUpdate"]>
let gradings: RemoteGradings

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
  sentTasks = []
  dispatchResult = { accepted: true }
  sendGradingUpdate = vi.fn<RemoteGradingsDeps["sendGradingUpdate"]>(() => Promise.resolve())
  gradings = new RemoteGradings({
    config: () => CONFIG,
    dispatch: (task) => {
      sentTasks.push(task)
      return Promise.resolve(dispatchResult)
    },
    sendGradingUpdate,
    now: Date.now,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function tokenOf(send: number): SandboxTokenPayload {
  const task = sentTasks[send]
  const payload = task && openToken(task.token, CONFIG.tokenKeys, Date.now())
  if (!payload) {
    throw new Error(`no token for send ${send.toString()}`)
  }
  return payload
}

describe("RemoteGradings", () => {
  it("reports the sandbox's result to the grading-update URL in the token", async () => {
    expect(await gradings.start(REQUEST)).toBeNull()
    const token = tokenOf(0)
    expect(token).toMatchObject({ url: REQUEST.gradingUpdateUrl, claim: "claim", points: ["1.1"] })
    expect(sentTasks[0]?.submissionId).toBe("cmf-sub-1")

    expect(gradings.handleCallback(token, PASSED)).toBe(true)
    expect(sendGradingUpdate).toHaveBeenCalledWith(
      REQUEST.gradingUpdateUrl,
      "claim",
      expect.objectContaining({ grading_progress: "FullyGraded", score_given: 1 }),
    )
  })

  it("ignores a repeated callback", async () => {
    await gradings.start(REQUEST)
    const token = tokenOf(0)
    gradings.handleCallback(token, PASSED)
    expect(gradings.handleCallback(token, PASSED)).toBe(false)
    expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
  })

  it("reports a result whose grading this process no longer knows, as after a restart", () => {
    const token: SandboxTokenPayload = {
      v: 1,
      url: "http://lms/grading-update/other",
      claim: null,
      points: ["1.1"],
      nonce: "unknown",
      exp: Date.now() + MINUTE,
    }
    expect(gradings.handleCallback(token, PASSED)).toBe(true)
    expect(sendGradingUpdate).toHaveBeenCalledWith(
      "http://lms/grading-update/other",
      null,
      expect.objectContaining({ grading_progress: "FullyGraded" }),
    )
  })

  it("resends a task with no result every 5 minutes and fails it after 3 sends", async () => {
    await gradings.start(REQUEST)
    await vi.advanceTimersByTimeAsync(5 * MINUTE - 1)
    expect(sentTasks).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(sentTasks).toHaveLength(2)
    expect(tokenOf(1).nonce).not.toBe(tokenOf(0).nonce)
    await vi.advanceTimersByTimeAsync(5 * MINUTE)
    expect(sentTasks).toHaveLength(3)
    expect(sendGradingUpdate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5 * MINUTE)
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

  it("takes a late result from an earlier send and ignores the resent task's", async () => {
    await gradings.start(REQUEST)
    await vi.advanceTimersByTimeAsync(5 * MINUTE)
    expect(sentTasks).toHaveLength(2)
    expect(gradings.handleCallback(tokenOf(0), PASSED)).toBe(true)
    expect(gradings.handleCallback(tokenOf(1), PASSED)).toBe(false)
    await vi.advanceTimersByTimeAsync(30 * MINUTE)
    expect(sentTasks).toHaveLength(2)
    expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
  })

  it("resends at once when the sandbox fails to run the task, until out of sends", async () => {
    await gradings.start(REQUEST)
    const sandboxError: CallbackOutcome = { sandboxError: "docker pull failed" }
    expect(gradings.handleCallback(tokenOf(0), sandboxError)).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(sentTasks).toHaveLength(2)
    gradings.handleCallback(tokenOf(1), sandboxError)
    await vi.advanceTimersByTimeAsync(0)
    expect(sentTasks).toHaveLength(3)
    expect(sendGradingUpdate).not.toHaveBeenCalled()
    gradings.handleCallback(tokenOf(2), sandboxError)
    expect(sendGradingUpdate).toHaveBeenCalledWith(
      REQUEST.gradingUpdateUrl,
      "claim",
      expect.objectContaining({ feedback_json: { feedback_key: "server_error" } }),
    )
  })

  it("does not resend when an older send fails while a newer one runs", async () => {
    await gradings.start(REQUEST)
    await vi.advanceTimersByTimeAsync(5 * MINUTE)
    expect(sentTasks).toHaveLength(2)
    expect(gradings.handleCallback(tokenOf(0), { sandboxError: "docker pull failed" })).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(sentTasks).toHaveLength(2)
    expect(gradings.handleCallback(tokenOf(1), PASSED)).toBe(true)
    expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
  })

  it("keeps a resend's result when the first dispatch fails after the resend was accepted", async () => {
    let failFirstDispatch: ((result: DispatchResult) => void) | undefined
    const failure: DispatchResult = {
      accepted: false,
      result: {
        grading_progress: "Failed",
        score_given: 0,
        score_maximum: 0,
        feedback_text: "busy",
        feedback_json: { feedback_key: "sandbox_busy" },
      },
    }
    gradings = new RemoteGradings({
      config: () => CONFIG,
      dispatch: (task) => {
        sentTasks.push(task)
        if (sentTasks.length === 1) {
          return new Promise((resolve) => {
            failFirstDispatch = resolve
          })
        }
        return Promise.resolve({ accepted: true })
      },
      sendGradingUpdate,
      now: Date.now,
    })
    const started = gradings.start(REQUEST)
    await vi.advanceTimersByTimeAsync(0)
    gradings.handleCallback(tokenOf(0), { sandboxError: "docker pull failed" })
    await vi.advanceTimersByTimeAsync(0)
    expect(sentTasks).toHaveLength(2)
    failFirstDispatch?.(failure)
    expect(await started).toBeNull()
    expect(gradings.handleCallback(tokenOf(1), PASSED)).toBe(true)
    expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
    expect(sendGradingUpdate).toHaveBeenCalledWith(
      REQUEST.gradingUpdateUrl,
      "claim",
      expect.objectContaining({ grading_progress: "FullyGraded" }),
    )
  })

  it("fails the grading when a resend throws", async () => {
    await gradings.start(REQUEST)
    dispatchResult = undefined as unknown as DispatchResult
    await vi.advanceTimersByTimeAsync(5 * MINUTE)
    expect(sendGradingUpdate).toHaveBeenCalledWith(
      REQUEST.gradingUpdateUrl,
      "claim",
      expect.objectContaining({ feedback_json: { feedback_key: "server_error" } }),
    )
  })

  it("returns the dispatch failure and keeps nothing pending", async () => {
    const failure = {
      grading_progress: "Failed" as const,
      score_given: 0,
      score_maximum: 0,
      feedback_text: "busy",
      feedback_json: { feedback_key: "sandbox_busy" },
    }
    dispatchResult = { accepted: false, result: failure }
    expect(await gradings.start(REQUEST)).toEqual(failure)
    await vi.advanceTimersByTimeAsync(30 * MINUTE)
    expect(sentTasks).toHaveLength(1)
  })

  it("fails fast while too many archive bytes wait for results", async () => {
    const big = { ...REQUEST, archive: Buffer.alloc(40 * 1024 * 1024) }
    expect(await gradings.start(big)).toBeNull()
    expect(await gradings.start(big)).toMatchObject({
      grading_progress: "Failed",
      feedback_json: { feedback_key: "sandbox_busy" },
    })
    expect(sentTasks).toHaveLength(1)
    gradings.handleCallback(tokenOf(0), PASSED)
    expect(await gradings.start(big)).toBeNull()
  })

  it("fails as a server error when the result is not a tmc-langs run result", async () => {
    await gradings.start(REQUEST)
    gradings.handleCallback(tokenOf(0), {
      run: { timedOut: false, output: "", parsed: { nope: 1 }, validations: null },
    })
    expect(sendGradingUpdate).toHaveBeenCalledWith(
      REQUEST.gradingUpdateUrl,
      "claim",
      expect.objectContaining({ feedback_json: { feedback_key: "server_error" } }),
    )
  })
})

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
