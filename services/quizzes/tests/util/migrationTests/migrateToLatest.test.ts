import {
  createEmptyPrivateSpec,
  migratePrivateSpecToLatest,
  migrateUserAnswerToLatest,
} from "../../../src/util/migration/migrateToLatest"
import { LATEST_QUIZ_VERSION } from "../../../src/util/migration/versions"
import type { PrivateSpecQuizItemClosedEndedQuestion } from "../../../types/quizTypes/privateSpec"
import { oldGenerateQuiz } from "../../api/utils/oldQuizGenerator"
import {
  generateClosedEndedForOlderPrivateSpecQuiz,
  generateMultipleChoicePrivateSpecQuiz,
  packToPrivateSpecQuiz,
} from "./utils/exerciseGeneration"

describe("migrateToLatest chain", () => {
  test("lifts a v1 (versionless) private spec all the way to the latest version", () => {
    const oldQuiz = packToPrivateSpecQuiz([generateClosedEndedForOlderPrivateSpecQuiz(1)])
    const migrated = migratePrivateSpecToLatest(oldQuiz)

    expect(migrated.version).toBe(LATEST_QUIZ_VERSION)
    const item = migrated.items[0] as PrivateSpecQuizItemClosedEndedQuestion
    expect(item.type).toBe("closed-ended-question")
    // v1/v2 closed-ended items were graded as regexes, so they land on the regex strategy.
    expect(item.gradingStrategy?.strategy).toBe("regex")
  })

  test("returns an already-latest spec unchanged", () => {
    const latest = createEmptyPrivateSpec()
    const migrated = migratePrivateSpecToLatest(latest)
    expect(migrated).toStrictEqual(latest)
  })

  test("throws on an unknown/future version", () => {
    expect(() => migratePrivateSpecToLatest({ version: "99", items: [] })).toThrow(
      /no private spec migration step from version '99'/i,
    )
  })

  test("throws on an unknown v1 item type instead of fabricating data", () => {
    const bogus = oldGenerateQuiz({
      id: "bogus-quiz",
      items: [{ id: "x", type: "not-a-real-type", order: 0, options: [] }],
      // oxlint-disable-next-line typescript/no-explicit-any -- deliberately corrupt fixture
    } as any)
    expect(() => migratePrivateSpecToLatest(bogus)).toThrow(/unknown quiz item type/i)
  })

  test("applies the legacy option-feedback fixup on the shared path (not just the editor)", () => {
    // A v1 multiple-choice option carrying only success/failure messages should have them folded
    // into messageAfterSubmissionWhenSelected during the v1->v2 step, on every entry door.
    const item = generateMultipleChoicePrivateSpecQuiz(1, 2, 0)
    item.options = item.options.map((option, idx) => ({
      ...option,
      correct: idx === 0,
      messageAfterSubmissionWhenSelected: null,
      successMessage: "correct feedback",
      failureMessage: "wrong feedback",
    }))
    const oldQuiz = packToPrivateSpecQuiz([item])

    const migrated = migratePrivateSpecToLatest(oldQuiz)
    const migratedItem = migrated.items[0]!
    if (migratedItem.type !== "multiple-choice") {
      throw new Error("expected a multiple-choice item")
    }
    expect(migratedItem.options[0]?.messageAfterSubmissionWhenSelected).toBe("correct feedback")
    expect(migratedItem.options[1]?.messageAfterSubmissionWhenSelected).toBe("wrong feedback")
  })

  test("migrates a v1 answer against the migrated spec", () => {
    const oldQuiz = packToPrivateSpecQuiz([generateClosedEndedForOlderPrivateSpecQuiz(1)])
    const migratedSpec = migratePrivateSpecToLatest(oldQuiz)
    const itemId = migratedSpec.items[0]!.id

    const oldAnswer = {
      itemAnswers: [{ id: "a1", quizItemId: itemId, textData: "hello", valid: true }],
    }
    const migratedAnswer = migrateUserAnswerToLatest(oldAnswer, migratedSpec)
    expect(migratedAnswer?.version).toBe(LATEST_QUIZ_VERSION)
    expect(migratedAnswer?.itemAnswers[0]?.quizItemId).toBe(itemId)
  })

  test("returns null for a null answer blob", () => {
    const migratedSpec = createEmptyPrivateSpec()
    expect(migrateUserAnswerToLatest(null, migratedSpec)).toBeNull()
  })
})
