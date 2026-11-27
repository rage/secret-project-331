// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"

import { sendGradingUpdate } from "./gradingUpdate"

vi.mock("@/util/podExecution", () => ({ delay: () => Promise.resolve() }))

const RESULT: ExerciseTaskGradingResult = {
  grading_progress: "FullyGraded",
  score_given: 1,
  score_maximum: 1,
  feedback_text: null,
  feedback_json: null,
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("sendGradingUpdate", () => {
  it("resolves true once the host takes the update, sending the claim", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response("{}")))
    vi.stubGlobal("fetch", fetch)
    expect(await sendGradingUpdate("http://lms/u", "claim", RESULT)).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      "http://lms/u",
      expect.objectContaining({
        headers: expect.objectContaining({
          [EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER]: "claim",
        }),
      }),
    )
  })

  it("leaves out an empty claim", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response("{}")))
    vi.stubGlobal("fetch", fetch)
    await sendGradingUpdate("http://lms/u", "", RESULT)
    expect(fetch).toHaveBeenCalledWith(
      "http://lms/u",
      expect.objectContaining({
        headers: { "content-type": "application/json" },
      }),
    )
  })

  it("resolves false when the host refuses every attempt", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetch = vi.fn(() => Promise.resolve(new Response("busy", { status: 503 })))
    vi.stubGlobal("fetch", fetch)
    expect(await sendGradingUpdate("http://lms/u", null, RESULT)).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(5)
  })
})
