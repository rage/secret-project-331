import { describe, expect, it } from "vitest"

import { assertNoLeak, LeakError } from "./leakGuard"
import { handleModelSolution } from "./modelSolution"
import { handlePublicSpec } from "./publicSpec"

// A representative private spec: two options, one correct, plus answer-revealing content that must
// never reach a student-visible projection.
const PRIVATE_SPEC = [
  { id: "opt-a", name: "Helsinki", correct: true },
  { id: "opt-b", name: "Tampere", correct: false },
]

function specRequest(privateSpec: unknown): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "r1", upload_url: null, private_spec: privateSpec }),
  })
}

describe("assertNoLeak", () => {
  it("passes a clean projection", () => {
    expect(() =>
      assertNoLeak([{ id: "a", name: "A" }], { forbiddenKeys: ["correct"], forbiddenValues: [] }),
    ).not.toThrow()
  })

  it("catches a forbidden KEY anywhere (nested included)", () => {
    expect(() =>
      assertNoLeak([{ id: "a", name: "A", correct: true }], {
        forbiddenKeys: ["correct"],
        forbiddenValues: [],
      }),
    ).toThrow(LeakError)
  })

  it("catches a forbidden VALUE even when no forbidden key is present", () => {
    // The leak was renamed away from `correct`, so a key-only guard would miss it — the value guard
    // still catches the answer-revealing string.
    expect(() =>
      assertNoLeak([{ id: "a", name: "A", hint: "the answer is A" }], {
        forbiddenKeys: ["correct"],
        forbiddenValues: ["the answer is A"],
      }),
    ).toThrow(LeakError)
  })

  it("does not false-positive when a short forbidden value is only hex inside a legitimate id", () => {
    // Regression: single-character option names ("a"/"b"/"c") must not be treated as leaked just
    // because those letters appear as hex digits inside a correct-option UUID that legitimately
    // ships in the model solution. The forbidden value must survive as its own JSON string to count.
    expect(() =>
      assertNoLeak(
        { version: "1", correctOptionIds: ["8a75cd7a-cb06-5867-a2d3-70a6ab992339"] },
        { forbiddenKeys: ["correct", "name"], forbiddenValues: ["a", "b", "c"] },
      ),
    ).not.toThrow()
  })
})

describe("leak regression over a representative private spec", () => {
  it("public-spec output has no forbidden key or answer-revealing value", async () => {
    const res = await handlePublicSpec(specRequest(PRIVATE_SPEC))
    expect(res.status).toBe(200)
    const spec = await res.json()
    const serialized = JSON.stringify(spec)
    expect(serialized).not.toContain("correct")
    // Options and their public names are allowed; the `correct` flag is not.
    expect(spec).toEqual([
      { id: "opt-a", name: "Helsinki" },
      { id: "opt-b", name: "Tampere" },
    ])
  })

  it("model-solution output reveals only correct ids, no names or wrong ids", async () => {
    const res = await handleModelSolution(specRequest(PRIVATE_SPEC))
    expect(res.status).toBe(200)
    const solution = (await res.json()) as { correctOptionIds: string[] }
    expect(solution.correctOptionIds).toEqual(["opt-a"])
    const serialized = JSON.stringify(solution)
    expect(serialized).not.toContain("Helsinki") // no option names leak
    expect(serialized).not.toContain("opt-b") // no incorrect-option id leaks
    expect(serialized).not.toContain("Tampere")
  })
})
