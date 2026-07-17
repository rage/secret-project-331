/**
 * v2 -> v3 migration.
 *
 * v3 only changed the `closed-ended-question` item type: its `validityRegex` / `formatRegex` pair
 * became a discriminated `gradingStrategy` union (see `types/quizTypes/privateSpec.ts`). Every other
 * item type is passed through unchanged.
 *
 * Every v2 closed-ended item was actually graded by running `validityRegex` as a RegExp, so we
 * migrate it to the `regex` strategy to preserve grading behavior exactly. We deliberately do NOT
 * try to guess whether the teacher "meant" an exact string — a literal graded as a regex differs
 * from one graded as a string, and silently changing grading during migration would be worse than
 * the status quo. Teachers upgrade an item to exact-match / numeric by editing it.
 */
import type { UserAnswer } from "../../../types/quizTypes/answer"
import type { ModelSolutionQuiz } from "../../../types/quizTypes/modelSolutionSpec"
import type { PrivateSpecQuiz } from "../../../types/quizTypes/privateSpec"
import type { PublicSpecQuiz } from "../../../types/quizTypes/publicSpec"
import type {
  ModelSolutionQuizV2,
  PrivateSpecQuizV2,
  PublicSpecQuizV2,
  UserAnswerV2,
} from "../../../types/quizTypes/v2"

export const migratePrivateSpecV2ToV3 = (quiz: PrivateSpecQuizV2): PrivateSpecQuiz => {
  return {
    ...quiz,
    version: "3",
    items: quiz.items.map((item) => {
      if (item.type !== "closed-ended-question") {
        return item
      }
      const { validityRegex, ...rest } = item
      return {
        ...rest,
        gradingStrategy:
          validityRegex !== null
            ? {
                strategy: "regex",
                pattern: validityRegex.trim(),
                caseSensitive: true,
                matchWholeAnswer: false,
                exampleCorrectAnswer: null,
              }
            : null,
      }
    }),
  }
}

export const migrateModelSolutionV2ToV3 = (quiz: ModelSolutionQuizV2): ModelSolutionQuiz => {
  return {
    ...quiz,
    version: "3",
    items: quiz.items.map((item) => {
      if (item.type !== "closed-ended-question") {
        return item
      }
      // A stored v2 model solution never carried a correct answer, so there is nothing to reveal.
      // Freshly saved v3 exercises get their display texts from the derivation in modelSolution.ts.
      return { ...item, correctAnswerDisplayTexts: null }
    }),
  }
}

export const migratePublicSpecV2ToV3 = (quiz: PublicSpecQuizV2): PublicSpecQuiz => {
  // Public closed-ended items are structurally unchanged between v2 and v3.
  return { ...quiz, version: "3" }
}

export const migrateUserAnswerV2ToV3 = (answer: UserAnswerV2): UserAnswer => {
  // The answer shape is structurally unchanged between v2 and v3.
  return { ...answer, version: "3" }
}
