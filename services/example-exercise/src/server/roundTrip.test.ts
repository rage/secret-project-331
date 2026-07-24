import { describe, expect, it } from "vitest"

import type { PublicAlternative } from "@/util/stateInterfaces"

import { handleGrade } from "./grade"
import { handlePublicSpec } from "./publicSpec"

// Proves public <-> private id correspondence end to end: a client only ever sees the PUBLIC spec,
// builds its answer from a public option id, and grading matches that id against the PRIVATE spec.
// If a future change re-minted ids in the public-spec derivation, real students' answers would
// silently score zero — this test would catch it.

const PRIVATE_SPEC = [
  { id: "opt-a", name: "Right", correct: true },
  { id: "opt-b", name: "Wrong", correct: false },
]

async function derivePublicSpec(): Promise<PublicAlternative[]> {
  const res = await handlePublicSpec(
    new Request("http://localhost/api/public-spec", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: "r1", upload_url: null, private_spec: PRIVATE_SPEC }),
    }),
  )
  expect(res.status).toBe(200)
  return (await res.json()) as PublicAlternative[]
}

async function gradePublicChoice(
  publicOption: PublicAlternative,
): Promise<Record<string, unknown>> {
  // Build the answer the way a real client does: from the public option's id, with no access to the
  // private spec's `correct` flag.
  const res = await handleGrade(
    new Request("http://localhost/api/grade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grading_update_url: "http://x",
        exercise_spec: PRIVATE_SPEC,
        submission_data: { selectedOptionId: publicOption.id },
      }),
    }),
  )
  expect(res.status).toBe(200)
  return (await res.json()) as Record<string, unknown>
}

describe("public/private round trip", () => {
  it("scores a public option that maps to the correct private option with full marks", async () => {
    const publicSpec = await derivePublicSpec()
    const chosen = publicSpec.find((option) => option.id === "opt-a")
    expect(chosen).toBeDefined()

    const result = await gradePublicChoice(chosen as PublicAlternative)
    expect(result.score_given).toBe(1)
    expect(result.score_maximum).toBe(1)
    expect(result.feedback_json).toEqual({ version: "1", selectedOptionIsCorrect: true })
  })

  it("scores a public option that maps to a wrong private option with the policy (zero) score", async () => {
    const publicSpec = await derivePublicSpec()
    const chosen = publicSpec.find((option) => option.id === "opt-b")
    expect(chosen).toBeDefined()

    const result = await gradePublicChoice(chosen as PublicAlternative)
    expect(result.score_given).toBe(0)
    expect(result.feedback_json).toEqual({ version: "1", selectedOptionIsCorrect: false })
  })
})
