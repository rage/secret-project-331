import { migratePrivateSpecV2ToV3 } from "../../../src/util/migration/v2ToV3"
import type {
  PrivateSpecQuizItemClosedEndedQuestionV2,
  PrivateSpecQuizV2,
} from "../../../types/quizTypes/v2"
// The v2 quiz re-uses the v3 essay shape (only closed-ended changed between v2 and v3).
import type { PrivateSpecQuizItemEssayV3 as PrivateSpecQuizItemEssay } from "../../../types/quizTypes/v3"

const essayItem: PrivateSpecQuizItemEssay = {
  type: "essay",
  id: "essay-1",
  order: 1,
  minWords: 0,
  maxWords: 100,
  title: "Essay",
  body: null,
  successMessage: null,
  failureMessage: null,
  messageOnModelSolution: null,
}

const v2Quiz = (closedEnded: PrivateSpecQuizItemClosedEndedQuestionV2): PrivateSpecQuizV2 => ({
  version: "2",
  awardPointsEvenIfWrong: false,
  grantPointsPolicy: "grant_whenever_possible",
  quizItemDisplayDirection: "vertical",
  title: null,
  body: null,
  submitMessage: null,
  items: [closedEnded, essayItem],
})

const v2ClosedEnded = (validityRegex: string | null): PrivateSpecQuizItemClosedEndedQuestionV2 => ({
  type: "closed-ended-question",
  id: "closed-1",
  order: 0,
  validityRegex,
  formatRegex: "[a-z]+",
  title: "Q",
  body: null,
  successMessage: null,
  failureMessage: null,
  messageOnModelSolution: null,
})

describe("closed-ended v2 -> v3 migration", () => {
  test("maps validityRegex to the regex strategy, preserving grading behavior", () => {
    const migrated = migratePrivateSpecV2ToV3(v2Quiz(v2ClosedEnded("  ^\\d+$  ")))
    expect(migrated.version).toBe("3")

    const item = migrated.items[0]!
    if (item.type !== "closed-ended-question") {
      throw new Error("expected closed-ended item")
    }
    expect(item.gradingStrategy).toStrictEqual({
      strategy: "regex",
      pattern: "^\\d+$", // trimmed, matching how v2 grading used validityRegex.trim()
      caseSensitive: true,
      matchWholeAnswer: false,
      exampleCorrectAnswer: null,
    })
    expect(item.formatRegex).toBe("[a-z]+")
    // The removed field must not linger.
    expect("validityRegex" in item).toBe(false)
  })

  test("a null validityRegex becomes a null (draft) grading strategy", () => {
    const migrated = migratePrivateSpecV2ToV3(v2Quiz(v2ClosedEnded(null)))
    const item = migrated.items[0]!
    if (item.type !== "closed-ended-question") {
      throw new Error("expected closed-ended item")
    }
    expect(item.gradingStrategy).toBeNull()
  })

  test("passes every other item type through unchanged", () => {
    const migrated = migratePrivateSpecV2ToV3(v2Quiz(v2ClosedEnded("x")))
    expect(migrated.items[1]).toStrictEqual(essayItem)
  })
})
