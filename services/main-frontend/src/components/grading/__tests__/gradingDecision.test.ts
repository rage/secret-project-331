import {
  buildGradingDecision,
  type GradingDecisionFormValues,
  type GradingReason,
  type GradingTarget,
  isFullPoints,
  isZeroPoints,
  resolveAction,
} from "../gradingDecision"

const TARGET: GradingTarget = {
  userExerciseStateId: "5d1cd8d4-4ba0-4d13-a4e3-3f0ba1b71b13",
  exerciseId: "0d2c0b0a-58b4-4a92-9d5c-3a58b8f9b1a2",
  exerciseMaxPoints: 3,
}

const formValues = (
  overrides: Partial<GradingDecisionFormValues> = {},
): GradingDecisionFormValues => ({
  points: TARGET.exerciseMaxPoints,
  reason: "bad-answer",
  resetExercise: false,
  feedback: "",
  ...overrides,
})

describe("resolveAction", () => {
  it("reads any non-zero score below the maximum as custom points", () => {
    expect(resolveAction(1.5, "bad-answer", 3)).toBe("CustomPoints")
  })

  it("reads the maximum as full points", () => {
    expect(resolveAction(3, "bad-answer", 3)).toBe("FullPoints")
  })

  // Each reason is the only thing that tells these decisions apart in the database, so a
  // mis-wired pair would be invisible in the UI and only surface as a rejected enum value.
  it.each<[GradingReason, string]>([
    ["bad-answer", "BadAnswer"],
    ["plagiarism", "SuspectedPlagiarism"],
    ["unauthorized-ai-use", "UnauthorizedAiUse"],
    ["other", "Other"],
  ])("maps the reason %s to %s at zero points", (reason, expected) => {
    expect(resolveAction(0, reason, 3)).toBe(expected)
  })

  it("ignores the reason above zero points", () => {
    expect(resolveAction(1, "plagiarism", 3)).toBe("CustomPoints")
  })

  it("treats a missing value as zero points", () => {
    expect(resolveAction(null, "other", 3)).toBe("Other")
  })

  it("prefers the reason over full points when the exercise is worth nothing", () => {
    expect(resolveAction(0, "bad-answer", 0)).toBe("BadAnswer")
  })
})

describe("point boundaries", () => {
  it("does not let float error turn the maximum into custom points", () => {
    expect(isFullPoints(0.1 + 0.2, 0.3)).toBe(true)
    expect(resolveAction(0.1 + 0.2, "bad-answer", 0.3)).toBe("FullPoints")
  })

  it("keeps a score just below the maximum out of full points", () => {
    expect(isFullPoints(2.99, 3)).toBe(false)
  })

  it("counts float error around zero as zero points", () => {
    expect(isZeroPoints(1e-12)).toBe(true)
    expect(isZeroPoints(0.01)).toBe(false)
  })
})

describe("buildGradingDecision", () => {
  it("sends the score only for custom points", () => {
    expect(buildGradingDecision(formValues({ points: 1.5 }), TARGET)).toMatchObject({
      action: "CustomPoints",
      manual_points: 1.5,
    })
    expect(buildGradingDecision(formValues(), TARGET).manual_points).toBeNull()
    expect(buildGradingDecision(formValues({ points: 0 }), TARGET).manual_points).toBeNull()
  })

  it("drops feedback written before the score was raised to the maximum", () => {
    const decision = buildGradingDecision(formValues({ feedback: "Nearly there" }), TARGET)
    expect(decision.action).toBe("FullPoints")
    expect(decision.justification).toBeNull()
  })

  it("trims feedback and treats blank feedback as none", () => {
    expect(
      buildGradingDecision(formValues({ points: 0, feedback: "  Cite your source  " }), TARGET)
        .justification,
    ).toBe("Cite your source")
    expect(
      buildGradingDecision(formValues({ points: 0, feedback: "   " }), TARGET).justification,
    ).toBeNull()
  })

  it("only resets at zero points, so lowering the score cannot reopen the exercise", () => {
    expect(
      buildGradingDecision(formValues({ points: 0, resetExercise: true }), TARGET).reset_exercise,
    ).toBe(true)
    expect(
      buildGradingDecision(formValues({ points: 1.5, resetExercise: true }), TARGET).reset_exercise,
    ).toBe(false)
  })

  it("carries the target and never hides feedback from the student", () => {
    expect(buildGradingDecision(formValues({ points: 0 }), TARGET)).toMatchObject({
      user_exercise_state_id: TARGET.userExerciseStateId,
      exercise_id: TARGET.exerciseId,
      hidden: false,
    })
  })
})
