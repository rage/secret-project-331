import { describe, expect, it } from "vitest"

import {
  migrateAnswerToLatest,
  migrateFeedbackToLatest,
  migrateModelSolutionToLatest,
  migratePrivateSpecToLatest,
  migratePublicSpecToLatest,
} from "./migrateToLatest"
import { MalformedBlobError } from "./versions"

// Frozen shapes example-exercise stored before it versioned its blobs.
const ALTERNATIVES = [
  { id: "a", name: "Right", correct: true },
  { id: "b", name: "Wrong", correct: false },
]

describe("pre-versioning blobs", () => {
  it("lift to the latest version", () => {
    expect(migratePrivateSpecToLatest(ALTERNATIVES)).toEqual(ALTERNATIVES)
    expect(migratePublicSpecToLatest([{ id: "a", name: "Right" }])).toEqual([
      { id: "a", name: "Right" },
    ])
    expect(migrateModelSolutionToLatest({ correctOptionIds: ["a"] })).toEqual({
      correctOptionIds: ["a"],
    })
    expect(migrateAnswerToLatest({ selectedOptionId: "a" })).toEqual({ selectedOptionId: "a" })
    expect(migrateFeedbackToLatest({ selectedOptionIsCorrect: false })).toEqual({
      selectedOptionIsCorrect: false,
    })
  })

  it("still reject a shape that was never stored", () => {
    expect(() => migratePrivateSpecToLatest({ alternatives: ALTERNATIVES })).toThrow(
      MalformedBlobError,
    )
    expect(() => migrateAnswerToLatest({})).toThrow(MalformedBlobError)
    expect(() => migratePublicSpecToLatest("x")).toThrow(MalformedBlobError)
  })
})
