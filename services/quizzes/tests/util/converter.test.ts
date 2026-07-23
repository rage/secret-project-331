import { revealableCorrectAnswers } from "../../src/util/converter"

describe("revealableCorrectAnswers", () => {
  test("exact-match reveals the accepted answers (a copy, never the rule beyond them)", () => {
    const accepted = ["Paris", "paris"]
    const revealed = revealableCorrectAnswers({
      strategy: "exact-match",
      acceptedAnswers: accepted,
      caseSensitive: false,
      trimWhitespace: true,
    })
    expect(revealed).toEqual(["Paris", "paris"])
    expect(revealed).not.toBe(accepted)
  })

  test("exact-match with no accepted answers reveals nothing", () => {
    expect(
      revealableCorrectAnswers({
        strategy: "exact-match",
        acceptedAnswers: [],
        caseSensitive: false,
        trimWhitespace: true,
      }),
    ).toBeNull()
  })

  test("numeric reveals the stringified correct value", () => {
    expect(
      revealableCorrectAnswers({
        strategy: "numeric",
        correctValue: 3.14,
        tolerance: 0,
        acceptCommaAsDecimalSeparator: false,
      }),
    ).toEqual(["3.14"])
  })

  test("regex with an example reveals only the example, never the pattern", () => {
    const revealed = revealableCorrectAnswers({
      strategy: "regex",
      pattern: "^SECRET_PATTERN\\d+$",
      caseSensitive: true,
      matchWholeAnswer: true,
      exampleCorrectAnswer: "example-42",
    })
    expect(revealed).toEqual(["example-42"])
    expect(JSON.stringify(revealed)).not.toContain("SECRET_PATTERN")
  })

  test("regex without an example reveals nothing", () => {
    expect(
      revealableCorrectAnswers({
        strategy: "regex",
        pattern: "^SECRET_PATTERN\\d+$",
        caseSensitive: true,
        matchWholeAnswer: true,
        exampleCorrectAnswer: null,
      }),
    ).toBeNull()
  })

  test("a null (draft) strategy reveals nothing", () => {
    expect(revealableCorrectAnswers(null)).toBeNull()
  })
})
