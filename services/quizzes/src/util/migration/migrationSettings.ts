// Default value for choose-n exercise

import { UserAnswer } from "../../../types/quizTypes/answer"
import { ModelSolutionQuiz } from "../../../types/quizTypes/modelSolutionSpec"
import { PrivateSpecQuiz } from "../../../types/quizTypes/privateSpec"
import { PublicSpecQuiz } from "../../../types/quizTypes/publicSpec"
import { PublicQuiz, Quiz, QuizAnswer, QuizItemAnswer } from "../../../types/types"

// Not set in the previous version
const DEFAULT_N = 2

/**
 * Check if the quiz version is old.
 *
 * @param quiz Quiz
 * @see Quiz
 * @see PrivateSpecQuiz
 * @see PublicSpecQuiz
 * @see ModelSolutionQuiz
 * @returns True if the quiz is older format, false if not
 */
const isOldQuiz = (
  quiz:
    | Quiz
    | PublicQuiz
    | ModelSolutionQuiz
    | PrivateSpecQuiz
    | PublicSpecQuiz
    | ModelSolutionQuiz
    | QuizItemAnswer
    | QuizAnswer
    | null
    | undefined,
): boolean => {
  if (!quiz) {
    return false
  }
  // eslint-disable-next-line i18next/no-literal-string
  return !Object.prototype.hasOwnProperty.call(quiz, "version")
}

const isOldUserAnswer = (userAnswer: UserAnswer | QuizAnswer): boolean => {
  if (!userAnswer) {
    return false
  }
  // eslint-disable-next-line i18next/no-literal-string
  return !Object.prototype.hasOwnProperty.call(userAnswer, "version")
}

export { DEFAULT_N, isOldQuiz, isOldUserAnswer }
