import { checkClosedEndedQuestionCorrectness } from "../../src/grading/assessment/closed-ended-question"
import type { ClosedEndedQuestionGradingStrategy } from "../../types/quizTypes/privateSpec"

const exactMatch = (
  overrides: Partial<Extract<ClosedEndedQuestionGradingStrategy, { strategy: "exact-match" }>> = {},
): ClosedEndedQuestionGradingStrategy => ({
  strategy: "exact-match",
  acceptedAnswers: ["Paris"],
  caseSensitive: false,
  trimWhitespace: true,
  ...overrides,
})

const regex = (
  overrides: Partial<Extract<ClosedEndedQuestionGradingStrategy, { strategy: "regex" }>> = {},
): ClosedEndedQuestionGradingStrategy => ({
  strategy: "regex",
  pattern: "^\\d+$",
  caseSensitive: true,
  matchWholeAnswer: false,
  exampleCorrectAnswer: null,
  ...overrides,
})

const numeric = (
  overrides: Partial<Extract<ClosedEndedQuestionGradingStrategy, { strategy: "numeric" }>> = {},
): ClosedEndedQuestionGradingStrategy => ({
  strategy: "numeric",
  correctValue: 3.14,
  tolerance: 0,
  acceptCommaAsDecimalSeparator: true,
  ...overrides,
})

describe("closed-ended grading: exact-match", () => {
  test("matches a literal answer that would be an invalid/greedy regex", () => {
    // These would misbehave if treated as regexes; exact-match compares them as plain strings.
    expect(
      checkClosedEndedQuestionCorrectness(exactMatch({ acceptedAnswers: ["C++"] }), "C++"),
    ).toBe(true)
    expect(
      checkClosedEndedQuestionCorrectness(exactMatch({ acceptedAnswers: ["3.14"] }), "3x14"),
    ).toBe(false)
    expect(
      checkClosedEndedQuestionCorrectness(exactMatch({ acceptedAnswers: ["a+b"] }), "aaab"),
    ).toBe(false)
  })

  test("case-insensitive by default, case-sensitive when configured", () => {
    expect(checkClosedEndedQuestionCorrectness(exactMatch(), "paris")).toBe(true)
    expect(checkClosedEndedQuestionCorrectness(exactMatch({ caseSensitive: true }), "paris")).toBe(
      false,
    )
  })

  test("collapses surrounding/internal whitespace when trimWhitespace is on", () => {
    expect(checkClosedEndedQuestionCorrectness(exactMatch(), "  Paris  ")).toBe(true)
    expect(
      checkClosedEndedQuestionCorrectness(
        exactMatch({ acceptedAnswers: ["New York"] }),
        "New   York",
      ),
    ).toBe(true)
    expect(
      checkClosedEndedQuestionCorrectness(
        exactMatch({ acceptedAnswers: ["New York"], trimWhitespace: false }),
        "New   York",
      ),
    ).toBe(false)
  })

  test("accepts any of several answers", () => {
    const strategy = exactMatch({ acceptedAnswers: ["yes", "y", "true"] })
    expect(checkClosedEndedQuestionCorrectness(strategy, "TRUE")).toBe(true)
    expect(checkClosedEndedQuestionCorrectness(strategy, "no")).toBe(false)
  })
})

describe("closed-ended grading: regex", () => {
  test("matches per the pattern; unanchored by default", () => {
    expect(checkClosedEndedQuestionCorrectness(regex(), "42")).toBe(true)
    expect(checkClosedEndedQuestionCorrectness(regex({ pattern: "\\d+" }), "abc123")).toBe(true)
  })

  test("matchWholeAnswer anchors the pattern", () => {
    expect(
      checkClosedEndedQuestionCorrectness(
        regex({ pattern: "\\d+", matchWholeAnswer: true }),
        "abc123",
      ),
    ).toBe(false)
  })

  test("case-insensitive flag is honored", () => {
    expect(
      checkClosedEndedQuestionCorrectness(regex({ pattern: "^yes$", caseSensitive: false }), "YES"),
    ).toBe(true)
  })

  test("an uncompilable pattern grades as not matching rather than throwing", () => {
    expect(checkClosedEndedQuestionCorrectness(regex({ pattern: "(" }), "anything")).toBe(false)
  })
})

describe("closed-ended grading: numeric", () => {
  test("respects tolerance", () => {
    expect(checkClosedEndedQuestionCorrectness(numeric({ tolerance: 0.01 }), "3.14")).toBe(true)
    expect(checkClosedEndedQuestionCorrectness(numeric({ tolerance: 0.01 }), "3.2")).toBe(false)
    expect(
      checkClosedEndedQuestionCorrectness(numeric({ correctValue: 10, tolerance: 2 }), "11"),
    ).toBe(true)
  })

  test("accepts comma decimal separator when enabled", () => {
    expect(checkClosedEndedQuestionCorrectness(numeric({ tolerance: 0.01 }), "3,14")).toBe(true)
    expect(
      checkClosedEndedQuestionCorrectness(
        numeric({ tolerance: 0.01, acceptCommaAsDecimalSeparator: false }),
        "3,14",
      ),
    ).toBe(false)
  })

  test("non-numeric input is never correct", () => {
    expect(checkClosedEndedQuestionCorrectness(numeric({ tolerance: 100 }), "not a number")).toBe(
      false,
    )
  })
})

describe("closed-ended grading: draft", () => {
  test("a null strategy (draft) accepts anything, preserving the pre-v3 no-validityRegex behavior", () => {
    expect(checkClosedEndedQuestionCorrectness(null, "anything")).toBe(true)
    expect(checkClosedEndedQuestionCorrectness(null, "")).toBe(true)
  })
})
