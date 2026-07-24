import { describe, expect, it } from "vitest"

import { validatePrivateSpec, type Alternative } from "./stateInterfaces"

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
