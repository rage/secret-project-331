import {
  createEmptyPrivateSpec,
  migrateModelSolutionToLatest,
  migratePrivateSpecToLatest,
  migratePublicSpecToLatest,
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
    // detectQuizVersion rejects unknown version strings before any migration step runs.
    expect(() => migratePrivateSpecToLatest({ version: "99", items: [] })).toThrow(
      /malformed quiz blob: unsupported version "99"/i,
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
    // A v1 multiple-choice option carrying only success/failure messages has them folded into
    // messageAfterSubmissionWhenSelected during the v1->v2 step; by v4 that lands as a
    // when-selected-after-answer feedback message on the option.
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
    expect(migratedItem.options[0]?.feedbackMessages).toContainEqual({
      visibility: "when-selected-after-answer",
      message: "correct feedback",
    })
    expect(migratedItem.options[1]?.feedbackMessages).toContainEqual({
      visibility: "when-selected-after-answer",
      message: "wrong feedback",
    })
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

  test("an already-v4 user answer passes through unchanged", () => {
    const migratedSpec = createEmptyPrivateSpec()
    const answer = {
      version: LATEST_QUIZ_VERSION,
      itemAnswers: [{ type: "essay", valid: true, quizItemId: "e1", textData: "blue" }],
    }
    expect(migrateUserAnswerToLatest(answer, migratedSpec)).toStrictEqual(answer)
  })

  // A version whose value is a prototype-chain key must not resolve a step off Object.prototype;
  // detectQuizVersion rejects it up front as malformed.
  test("a 'constructor' version throws cleanly for the private-spec chain", () => {
    expect(() => migratePrivateSpecToLatest({ version: "constructor", items: [] })).toThrow(
      /malformed quiz blob: unsupported version/i,
    )
  })

  test("a 'constructor' version throws cleanly for the user-answer chain", () => {
    const migratedSpec = createEmptyPrivateSpec()
    expect(() =>
      migrateUserAnswerToLatest({ version: "constructor", itemAnswers: [] }, migratedSpec),
    ).toThrow(/malformed quiz blob: unsupported version/i)
  })
})

describe("migratePublicSpecToLatest chain", () => {
  // A v2-shaped public spec exercises the otherwise-untested v2->v3 and v3->v4 public steps.
  const v2PublicSpec = {
    version: "2",
    items: [
      {
        type: "essay",
        id: "essay-1",
        order: 0,
        minWords: 0,
        maxWords: 100,
        title: "Essay",
        body: null,
      },
    ],
    title: "Public",
    body: null,
    quizItemDisplayDirection: "vertical",
  }

  test("lifts a v2 public spec to the latest version", () => {
    const migrated = migratePublicSpecToLatest(v2PublicSpec)
    expect(migrated.version).toBe(LATEST_QUIZ_VERSION)
    expect(migrated.items[0]!.type).toBe("essay")
  })

  test("returns an already-latest public spec unchanged", () => {
    const latest = {
      version: LATEST_QUIZ_VERSION,
      items: [],
      title: null,
      body: null,
      quizItemDisplayDirection: "vertical",
    }
    expect(migratePublicSpecToLatest(latest)).toStrictEqual(latest)
  })

  test("throws on an unknown/future version", () => {
    expect(() => migratePublicSpecToLatest({ version: "99", items: [] })).toThrow(
      /malformed quiz blob: unsupported version "99"/i,
    )
  })
})

describe("migrateModelSolutionToLatest chain", () => {
  // A v2-shaped model solution exercises the v2->v3 step, incl. correctAnswerDisplayTexts defaulting.
  const v2ModelSolution = {
    version: "2",
    awardPointsEvenIfWrong: false,
    grantPointsPolicy: "grant_whenever_possible",
    items: [
      {
        type: "closed-ended-question",
        id: "closed-1",
        order: 0,
        formatRegex: "[a-z]+",
        title: "Q",
        body: null,
        successMessage: null,
        failureMessage: null,
        messageOnModelSolution: null,
      },
    ],
    title: null,
    body: null,
    submitMessage: null,
  }

  test("lifts a v2 model solution to the latest version and defaults correctAnswerDisplayTexts to null", () => {
    const migrated = migrateModelSolutionToLatest(v2ModelSolution)!
    expect(migrated.version).toBe(LATEST_QUIZ_VERSION)
    const item = migrated.items[0]!
    if (item.type !== "closed-ended-question") {
      throw new Error("expected closed-ended item")
    }
    expect(item.correctAnswerDisplayTexts).toBeNull()
  })

  test("returns null for a null model solution blob", () => {
    expect(migrateModelSolutionToLatest(null)).toBeNull()
  })

  test("returns an already-latest model solution unchanged", () => {
    const latest = {
      version: LATEST_QUIZ_VERSION,
      awardPointsEvenIfWrong: false,
      grantPointsPolicy: "grant_whenever_possible",
      title: null,
      body: null,
      items: [],
      messagesOnModelSolution: [],
    }
    expect(migrateModelSolutionToLatest(latest)).toStrictEqual(latest)
  })

  test("throws on an unknown/future version", () => {
    expect(() => migrateModelSolutionToLatest({ version: "99", items: [] })).toThrow(
      /malformed quiz blob: unsupported version "99"/i,
    )
  })
})
