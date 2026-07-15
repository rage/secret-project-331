import { describe, expect, it } from "vitest"

import {
  alternativesFromStored,
  parseModelSolution,
  parsePreviousSubmission,
  parsePrivateSpec,
  parsePublicSpec,
  toVersionedPrivateSpec,
  validatePrivateSpec,
  type Alternative,
} from "./stateInterfaces"

describe("validatePrivateSpec", () => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- test-local factory kept beside its describe
  const option = (over: Partial<Alternative>): Alternative => ({
    id: "id",
    name: "Option",
    correct: false,
    ...over,
  })

  it("accepts a spec with >=1 option, >=1 correct option and non-empty names", () => {
    const result = validatePrivateSpec([
      option({ id: "a", name: "Right", correct: true }),
      option({ id: "b", name: "Wrong" }),
    ])
    expect(result).toEqual({ valid: true, errors: [] })
  })

  it("flags an empty spec (no options)", () => {
    const result = validatePrivateSpec([])
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("validation-error-no-options")
    // An empty spec also has no correct option.
    expect(result.errors).toContain("validation-error-no-correct-option")
  })

  it("flags a spec with no correct option", () => {
    const result = validatePrivateSpec([option({ id: "a", name: "Only", correct: false })])
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(["validation-error-no-correct-option"])
  })

  it("flags a blank (whitespace-only) option name", () => {
    const result = validatePrivateSpec([
      option({ id: "a", name: "Right", correct: true }),
      option({ id: "b", name: "   " }),
    ])
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("validation-error-empty-option-name")
  })
})

describe("migration anchor (reference/07 #1)", () => {
  const ALTERNATIVES: Alternative[] = [
    { id: "a", name: "Right", correct: true },
    { id: "b", name: "Wrong", correct: false },
  ]

  it("lifts a legacy (no-version) private spec to the current shape", () => {
    // A bare array is the pre-version shape; migrate-on-read yields the same alternatives, and
    // wrapping (persist-on-save) produces the current versioned envelope.
    const migrated = parsePrivateSpec(ALTERNATIVES)
    expect(migrated).toEqual(ALTERNATIVES)
    expect(toVersionedPrivateSpec(migrated)).toEqual({ version: "1", alternatives: ALTERNATIVES })
  })

  it("passes a v1 private spec envelope through unchanged", () => {
    const envelope = { version: "1", alternatives: ALTERNATIVES }
    const migrated = parsePrivateSpec(envelope)
    expect(migrated).toEqual(ALTERNATIVES)
    expect(toVersionedPrivateSpec(migrated)).toEqual(envelope)
  })

  it("alternativesFromStored recognizes both shapes and rejects neither-shape", () => {
    expect(alternativesFromStored(ALTERNATIVES)).toEqual(ALTERNATIVES)
    expect(alternativesFromStored({ version: "1", alternatives: ALTERNATIVES })).toEqual(
      ALTERNATIVES,
    )
    expect(alternativesFromStored("nonsense")).toBeNull()
    expect(alternativesFromStored({})).toBeNull()
  })

  it("parsePublicSpec accepts a bare array and a future versioned envelope", () => {
    const options = [{ id: "a", name: "Right" }]
    expect(parsePublicSpec(options)).toEqual(options)
    expect(parsePublicSpec({ version: "1", options })).toEqual(options)
  })

  it("parseModelSolution accepts a bare and a versioned shape", () => {
    expect(parseModelSolution({ correctOptionIds: ["a"] })).toEqual({ correctOptionIds: ["a"] })
    expect(parseModelSolution({ version: "1", correctOptionIds: ["a"] })).toEqual({
      correctOptionIds: ["a"],
    })
  })
})

describe("parsePreviousSubmission", () => {
  it("returns the answer when a non-empty selectedOptionId is present", () => {
    expect(parsePreviousSubmission({ selectedOptionId: "abc" })).toEqual({
      selectedOptionId: "abc",
    })
  })

  it("returns null when there is nothing to prefill", () => {
    expect(parsePreviousSubmission(null)).toBeNull()
    expect(parsePreviousSubmission(undefined)).toBeNull()
    expect(parsePreviousSubmission({})).toBeNull()
    expect(parsePreviousSubmission({ selectedOptionId: "" })).toBeNull()
    expect(parsePreviousSubmission({ selectedOptionId: 5 })).toBeNull()
  })
})
