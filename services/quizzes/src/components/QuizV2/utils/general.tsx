import { PrivateSpecQuiz, QuizItemType } from "../../../../types/quizTypes"

/**
 * Find quiz item from quiz
 *
 * @param quiz PrivateSpecQuiz from which to search quiz item
 * @param quizItemId Id of the quiz item
 * @param quizItemType Quiz item type to be returned
 * @returns Found quiz item, null if it's not found
 */
const findQuizItem = <T,>(
  quiz: PrivateSpecQuiz | null,
  quizItemId: string,
  quizItemType: QuizItemType,
): T | null => {
  if (!quiz) {
    return null
  }

  const item = quiz.items.find((item) => item.id === quizItemId)
  if (!item) {
    return null
  }
  if (item.type === quizItemType) {
    return item as T
  }

  return null
}

export default findQuizItem
