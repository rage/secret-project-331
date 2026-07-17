// Default value for choose-n exercise

import type {
  OldPublicQuiz,
  OldQuiz,
  OldQuizAnswer,
  OldQuizItemAnswer,
} from "../../../types/oldQuizTypes"
import type { UserAnswer } from "../../../types/quizTypes/answer"
import type { ModelSolutionQuiz } from "../../../types/quizTypes/modelSolutionSpec"
import type { PrivateSpecQuiz } from "../../../types/quizTypes/privateSpec"
import type { PublicSpecQuiz } from "../../../types/quizTypes/publicSpec"

// Not set in the previous version
const DEFAULT_N = 10

/**
 * Check if the quiz version is old.
 *
 * @param quiz Quiz
 * @see OldQuiz
 * @see PrivateSpecQuiz
 * @see PublicSpecQuiz
 * @see ModelSolutionQuiz
 * @returns True if the quiz is older format, false if not
 */
const isOldQuiz = (
  quiz:
    | OldQuiz
    | OldPublicQuiz
    | ModelSolutionQuiz
    | PrivateSpecQuiz
    | PublicSpecQuiz
    | ModelSolutionQuiz
    | OldQuizItemAnswer
    | OldQuizAnswer
    | null
    | undefined,
): boolean => {
  if (!quiz) {
    return false
  }

  return !Object.prototype.hasOwnProperty.call(quiz, "version")
}

const isOldUserAnswer = (userAnswer: UserAnswer | OldQuizAnswer): boolean => {
  if (!userAnswer) {
    return false
  }

  return !Object.prototype.hasOwnProperty.call(userAnswer, "version")
}

export { DEFAULT_N, isOldQuiz, isOldUserAnswer }
