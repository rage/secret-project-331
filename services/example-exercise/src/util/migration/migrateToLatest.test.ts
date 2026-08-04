import { describe, expect, it } from "vitest"

import {
  migrateAnswerToLatest,
  migrateModelSolutionToLatest,
  migratePrivateSpecToLatest,
  migratePublicSpecToLatest,
  parseAnswer,
  parsePreviousSubmission,
  parseModelSolution,
  parsePrivateSpec,
  parsePublicSpec,
} from "./migrateToLatest"
import { detectVersion, LATEST_SPEC_VERSION } from "./versions"

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

describe("detectVersion", () => {
  it("treats a blob without a version field as the oldest (v1)", () => {
    expect(detectVersion(ALTERNATIVES)).toBe("1")
    expect(detectVersion({ alternatives: ALTERNATIVES })).toBe("1")
    expect(detectVersion("x")).toBe("1")
  })

  it("returns a known version string", () => {
    expect(detectVersion(PRIVATE_SPEC_V1)).toBe("1")
  })

  it("throws on an unknown/future version", () => {
    expect(() => detectVersion({ version: "2" })).toThrow(/unsupported version/i)
    expect(() => detectVersion({ version: 1 })).toThrow(/unsupported version/i)
  })
})

describe("migratePrivateSpecToLatest", () => {
  it("lifts a legacy (versionless) bare array to latest", () => {
    expect(migratePrivateSpecToLatest(ALTERNATIVES)).toEqual(ALTERNATIVES)
  })

  it("passes a v1 envelope through unchanged", () => {
    expect(migratePrivateSpecToLatest(PRIVATE_SPEC_V1)).toEqual(ALTERNATIVES)
  })

  it("returns null for an unrecognizable shape", () => {
    expect(migratePrivateSpecToLatest("x")).toBeNull()
    expect(migratePrivateSpecToLatest({})).toBeNull()
  })

  it("throws on an unknown/future version", () => {
    expect(() => migratePrivateSpecToLatest({ version: "2", alternatives: ALTERNATIVES })).toThrow(
      /unsupported version/i,
    )
  })
})

describe("migratePublicSpecToLatest", () => {
  it("accepts a bare array and a versioned envelope", () => {
    expect(migratePublicSpecToLatest([{ id: "a", name: "Right" }])).toEqual([
      { id: "a", name: "Right" },
    ])
    expect(migratePublicSpecToLatest(PUBLIC_SPEC_V1)).toEqual(PUBLIC_SPEC_V1.options)
  })

  it("drops non-PublicAlternative elements (world-readable, stay defensive)", () => {
    expect(migratePublicSpecToLatest([{ id: "a", name: "Right" }, { id: 1 }])).toEqual([
      { id: "a", name: "Right" },
    ])
  })

  it("returns null for an unrecognizable shape", () => {
    expect(migratePublicSpecToLatest("x")).toBeNull()
  })
})

describe("migrateModelSolutionToLatest", () => {
  it("accepts a bare and a versioned shape", () => {
    expect(migrateModelSolutionToLatest({ correctOptionIds: ["a"] })).toEqual({
      correctOptionIds: ["a"],
    })
    expect(migrateModelSolutionToLatest(MODEL_SOLUTION_V1)).toEqual({ correctOptionIds: ["a"] })
  })

  it("returns null for an unrecognizable shape", () => {
    expect(migrateModelSolutionToLatest({})).toBeNull()
    expect(migrateModelSolutionToLatest({ correctOptionIds: [1] })).toBeNull()
  })
})

describe("migrateAnswerToLatest", () => {
  it("accepts a legacy and a versioned shape", () => {
    expect(migrateAnswerToLatest({ selectedOptionId: "a" })).toEqual({ selectedOptionId: "a" })
    expect(migrateAnswerToLatest(ANSWER_V1)).toEqual({ selectedOptionId: "a" })
  })

  it("returns null for an unrecognizable shape", () => {
    expect(migrateAnswerToLatest({})).toBeNull()
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
    expect(parsePrivateSpec([{ id: "a" }])).toEqual([])
    expect(parsePrivateSpec({ version: "2" })).toEqual([])
  })

  it("parsePublicSpec defaults to []", () => {
    expect(parsePublicSpec("x")).toEqual([])
    expect(parsePublicSpec({ version: "2" })).toEqual([])
  })

  it("parseModelSolution defaults to null", () => {
    expect(parseModelSolution("x")).toBeNull()
    expect(parseModelSolution({ version: "2" })).toBeNull()
  })

  it("parseAnswer defaults to an empty answer", () => {
    expect(parseAnswer(ANSWER_V1)).toEqual({ selectedOptionId: "a" })
    expect(parseAnswer({})).toEqual({ selectedOptionId: "" })
    expect(parseAnswer({ version: "2" })).toEqual({ selectedOptionId: "" })
  })

  it("parsePreviousSubmission returns null when there is nothing to prefill", () => {
    expect(parsePreviousSubmission({ selectedOptionId: "abc" })).toEqual({
      selectedOptionId: "abc",
    })
    expect(parsePreviousSubmission(null)).toBeNull()
    expect(parsePreviousSubmission({ selectedOptionId: "" })).toBeNull()
    expect(parsePreviousSubmission({ selectedOptionId: 5 })).toBeNull()
  })
})
