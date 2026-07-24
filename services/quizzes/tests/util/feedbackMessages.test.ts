import {
  applicableItemFeedbackMessages,
  joinFeedbackMessages,
  resolveDisplayedFeedback,
} from "../../src/util/feedbackMessages"
import type { QuizFeedbackMessage } from "../../types/quizTypes/privateSpec"

const messages: QuizFeedbackMessage[] = [
  { visibility: "after-any-answer", message: "any" },
  { visibility: "after-correct-answer", message: "correct" },
  { visibility: "after-partially-correct-answer", message: "partial" },
  { visibility: "after-incorrect-answer", message: "incorrect" },
  { visibility: "on-model-solution", message: "model" },
]

describe("applicableItemFeedbackMessages", () => {
  test("after-any-answer shows at every correctness", () => {
    for (const coeff of [0, 0.5, 1]) {
      expect(applicableItemFeedbackMessages(messages, coeff)).toContain("any")
    }
  })

  test("correctness coefficient 1 shows correct but not partial or incorrect", () => {
    expect(applicableItemFeedbackMessages(messages, 1)).toEqual(["any", "correct"])
  })

  test("a coefficient strictly between 0 and 1 shows only the partial message", () => {
    expect(applicableItemFeedbackMessages(messages, 0.5)).toEqual(["any", "partial"])
  })

  test("coefficient 0 shows only the incorrect message", () => {
    expect(applicableItemFeedbackMessages(messages, 0)).toEqual(["any", "incorrect"])
  })

  test("on-model-solution never applies to after-answer feedback", () => {
    for (const coeff of [0, 0.5, 1]) {
      expect(applicableItemFeedbackMessages(messages, coeff)).not.toContain("model")
    }
  })

  test("boundaries just inside 0 and 1 count as partial", () => {
    expect(applicableItemFeedbackMessages(messages, 0.999)).toEqual(["any", "partial"])
    expect(applicableItemFeedbackMessages(messages, 0.001)).toEqual(["any", "partial"])
  })
})

describe("joinFeedbackMessages", () => {
  test("joins non-empty parts with a single space", () => {
    expect(joinFeedbackMessages(["one", "two"])).toBe("one two")
  })

  test("trims each part and drops empties", () => {
    expect(joinFeedbackMessages(["  one  ", "", "   ", "two"])).toBe("one two")
  })

  test("returns null when there is nothing to show", () => {
    expect(joinFeedbackMessages([])).toBeNull()
    expect(joinFeedbackMessages(["", "   "])).toBeNull()
  })
})

describe("resolveDisplayedFeedback", () => {
  test("non-empty model-solution messages replace the graded feedback", () => {
    expect(resolveDisplayedFeedback("graded", ["model one", "model two"])).toBe(
      "model one model two",
    )
  })

  test("falls back to graded feedback when there are no model-solution messages", () => {
    expect(resolveDisplayedFeedback("graded", [])).toBe("graded")
    expect(resolveDisplayedFeedback("graded", null)).toBe("graded")
    expect(resolveDisplayedFeedback("graded", undefined)).toBe("graded")
    expect(resolveDisplayedFeedback("graded", ["", "  "])).toBe("graded")
  })

  test("returns null when neither source has content", () => {
    expect(resolveDisplayedFeedback(null, null)).toBeNull()
    expect(resolveDisplayedFeedback(undefined, [])).toBeNull()
    expect(resolveDisplayedFeedback("   ", [])).toBeNull()
  })

  test("trims an old-blob graded feedback string", () => {
    expect(resolveDisplayedFeedback("  graded  ", [])).toBe("graded")
  })
})
