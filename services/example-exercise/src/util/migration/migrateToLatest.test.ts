import { describe, expect, it } from "vitest"

import {
  migrateAnswerToLatest,
  migrateFeedbackToLatest,
  migrateModelSolutionToLatest,
  migratePrivateSpecToLatest,
  migratePublicSpecToLatest,
  parseAnswer,
  parseFeedback,
  parseModelSolution,
  parsePreviousSubmission,
  parsePrivateSpec,
  parsePublicSpec,
} from "./migrateToLatest"
import { detectVersion, LATEST_SPEC_VERSION, MalformedBlobError } from "./versions"

// Frozen v1 snapshot fixtures. When v2 arrives these become the frozen v1 set (never edited, only
// added to) so the tests below keep proving that ancient v1 data still lifts to latest.
const ALTERNATIVES = [
  { id: "a", name: "Right", correct: true },
  { id: "b", name: "Wrong", correct: false },
]
const PRIVATE_SPEC_V1 = { version: "1", alternatives: ALTERNATIVES }
const PUBLIC_SPEC_V1 = { version: "1", options: [{ id: "a", name: "Right" }] }
const MODEL_SOLUTION_V1 = { version: "1", correctOptionIds: ["a"] }
const ANSWER_V1 = { version: "1", selectedOptionId: "a" }
const FEEDBACK_V1 = { version: "1", selectedOptionIsCorrect: true }

describe("detectVersion", () => {
  it("returns a known version", () => {
    expect(detectVersion(PRIVATE_SPEC_V1)).toBe("1")
  })

  it("rejects a blob without a version", () => {
    expect(() => detectVersion({ alternatives: ALTERNATIVES })).toThrow(MalformedBlobError)
    expect(() => detectVersion("x")).toThrow(MalformedBlobError)
    expect(() => detectVersion(null)).toThrow(MalformedBlobError)
  })

  it("rejects an unknown or future version", () => {
    expect(() => detectVersion({ version: "2" })).toThrow(MalformedBlobError)
    expect(() => detectVersion({ version: 1 })).toThrow(MalformedBlobError)
  })
})

describe("migratePrivateSpecToLatest", () => {
  it("passes a v1 envelope through unchanged", () => {
    expect(migratePrivateSpecToLatest(PRIVATE_SPEC_V1)).toEqual(ALTERNATIVES)
  })

  it("rejects an unreadable v1 shape", () => {
    expect(() => migratePrivateSpecToLatest({ version: "1" })).toThrow(MalformedBlobError)
  })

  it("rejects an unknown or future version", () => {
    expect(() => migratePrivateSpecToLatest({ version: "2", alternatives: ALTERNATIVES })).toThrow(
      MalformedBlobError,
    )
  })
})

describe("migratePublicSpecToLatest", () => {
  it("passes a v1 envelope through", () => {
    expect(migratePublicSpecToLatest(PUBLIC_SPEC_V1)).toEqual(PUBLIC_SPEC_V1.options)
  })

  it("drops non-PublicAlternative elements (world-readable, stay defensive)", () => {
    expect(
      migratePublicSpecToLatest({ version: "1", options: [{ id: "a", name: "Right" }, { id: 1 }] }),
    ).toEqual([{ id: "a", name: "Right" }])
  })

  it("rejects an unreadable shape", () => {
    expect(() => migratePublicSpecToLatest({ version: "1", options: "x" })).toThrow(
      MalformedBlobError,
    )
  })
})

describe("migrateModelSolutionToLatest", () => {
  it("passes a v1 shape through", () => {
    expect(migrateModelSolutionToLatest(MODEL_SOLUTION_V1)).toEqual({ correctOptionIds: ["a"] })
  })

  it("rejects an unreadable shape", () => {
    expect(() => migrateModelSolutionToLatest({ version: "1" })).toThrow(MalformedBlobError)
    expect(() => migrateModelSolutionToLatest({ version: "1", correctOptionIds: [1] })).toThrow(
      MalformedBlobError,
    )
  })
})

describe("migrateAnswerToLatest", () => {
  it("passes a v1 shape through", () => {
    expect(migrateAnswerToLatest(ANSWER_V1)).toEqual({ selectedOptionId: "a" })
  })

  it("rejects an unreadable shape", () => {
    expect(() => migrateAnswerToLatest({ version: "1" })).toThrow(MalformedBlobError)
  })
})

describe("migrateFeedbackToLatest", () => {
  it("passes a v1 shape through", () => {
    expect(migrateFeedbackToLatest(FEEDBACK_V1)).toEqual({ selectedOptionIsCorrect: true })
  })

  it("rejects an unreadable shape", () => {
    expect(() => migrateFeedbackToLatest({ version: "1" })).toThrow(MalformedBlobError)
  })
})

describe("latest version is 1", () => {
  it("all fixtures are already at the latest version", () => {
    expect(LATEST_SPEC_VERSION).toBe("1")
  })
})

// The forgiving iframe wrappers must never throw — a student's view degrades to a default instead.
describe("forgiving iframe wrappers", () => {
  it("parsePrivateSpec filters bad elements and defaults to []", () => {
    expect(parsePrivateSpec(PRIVATE_SPEC_V1)).toEqual(ALTERNATIVES)
    expect(parsePrivateSpec({ version: "1", alternatives: [{ id: "a" }] })).toEqual([])
    expect(parsePrivateSpec({ version: "2" })).toEqual([])
  })

  it("parsePublicSpec defaults to []", () => {
    expect(parsePublicSpec("x")).toEqual([])
    expect(parsePublicSpec({ version: "2" })).toEqual([])
  })

  it("parseModelSolution defaults to null", () => {
    expect(parseModelSolution(null)).toBeNull()
    expect(parseModelSolution({ version: "2" })).toBeNull()
  })

  it("parseAnswer defaults to an empty answer", () => {
    expect(parseAnswer(ANSWER_V1)).toEqual({ selectedOptionId: "a" })
    expect(parseAnswer({ version: "1" })).toEqual({ selectedOptionId: "" })
    expect(parseAnswer({ version: "2" })).toEqual({ selectedOptionId: "" })
  })

  it("parseFeedback defaults to null", () => {
    expect(parseFeedback(FEEDBACK_V1)).toEqual({ selectedOptionIsCorrect: true })
    expect(parseFeedback(null)).toBeNull()
    expect(parseFeedback({ version: "2", selectedOptionIsCorrect: true })).toBeNull()
  })

  it("parsePreviousSubmission returns null when there is nothing to prefill", () => {
    expect(parsePreviousSubmission({ version: "1", selectedOptionId: "abc" })).toEqual({
      selectedOptionId: "abc",
    })
    expect(parsePreviousSubmission(null)).toBeNull()
    expect(parsePreviousSubmission({ version: "1", selectedOptionId: "" })).toBeNull()
    expect(parsePreviousSubmission({ version: "1", selectedOptionId: 5 })).toBeNull()
  })
})
