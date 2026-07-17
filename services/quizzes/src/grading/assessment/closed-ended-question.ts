import { stripNonPrintableCharacters } from "@/shared-module/common/utils/strings"

import type { UserItemAnswerClosedEndedQuestion } from "../../../types/quizTypes/answer"
import type { QuizItemAnswerGrading } from "../../../types/quizTypes/grading"
import type {
  ClosedEndedQuestionGradingStrategy,
  PrivateSpecQuizItemClosedEndedQuestion,
} from "../../../types/quizTypes/privateSpec"

/**
 * Pure correctness check for a closed-ended answer, one branch per grading strategy.
 *
 * Exported so the editor's "test answer" table exercises the exact logic students are graded by.
 * All escaping and normalization happen here — never baked into stored authoring data — which is
 * why exact-match compares plain strings and can never mis-interpret an answer as a regex.
 */
export const checkClosedEndedQuestionCorrectness = (
  gradingStrategy: ClosedEndedQuestionGradingStrategy | null,
  rawInput: string,
): boolean => {
  const cleaned = stripNonPrintableCharacters(rawInput).replaceAll("\0", "")
  // A draft with no strategy chosen yet accepts anything (matches the pre-v3 "no validityRegex" case).
  if (gradingStrategy === null) {
    return true
  }
  switch (gradingStrategy.strategy) {
    case "exact-match": {
      const normalize = (value: string): string => {
        let result = value
        if (gradingStrategy.trimWhitespace) {
          result = result.trim().replaceAll(/\s+/g, " ")
        }
        if (!gradingStrategy.caseSensitive) {
          result = result.toLowerCase()
        }
        return result
      }
      const normalizedInput = normalize(cleaned)
      // Plain string equality: no RegExp is ever built, so a literal like `C++` or `3.14` is safe.
      return gradingStrategy.acceptedAnswers.some(
        (accepted) => normalize(accepted) === normalizedInput,
      )
    }
    case "regex": {
      const source = gradingStrategy.matchWholeAnswer
        ? `^(?:${gradingStrategy.pattern})$`
        : gradingStrategy.pattern
      try {
        const validator = new RegExp(source, gradingStrategy.caseSensitive ? "" : "i")
        return validator.test(cleaned.trim())
      } catch (_e) {
        // A misconfigured (uncompilable) pattern grades as not matching rather than crashing.
        return false
      }
    }
    case "numeric": {
      let text = cleaned.trim()
      if (gradingStrategy.acceptCommaAsDecimalSeparator) {
        text = text.replace(",", ".")
      }
      const value = Number(text)
      return (
        Number.isFinite(value) &&
        Math.abs(value - gradingStrategy.correctValue) <= gradingStrategy.tolerance
      )
    }
  }
}

const assessClosedEndedQuestion = (
  quizItemAnswer: UserItemAnswerClosedEndedQuestion,
  quizItem: PrivateSpecQuizItemClosedEndedQuestion,
): QuizItemAnswerGrading => {
  if (!quizItemAnswer) {
    throw new Error("No answer provided")
  }

  const correct = checkClosedEndedQuestionCorrectness(
    quizItem.gradingStrategy,
    quizItemAnswer.textData,
  )

  return {
    quizItemId: quizItem.id,
    correctnessCoefficient: correct ? 1 : 0,
  }
}

export { assessClosedEndedQuestion }
