import { UserAnswer } from "../../types/quizTypes/answer"
import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"
import { Quiz, QuizAnswer } from "../../types/types"
import { isOldQuiz, isOldUserAnswer } from "../util/migration/migrationSettings"
import { migratePrivateSpecQuiz } from "../util/migration/privateSpecQuiz"
import migrateQuizAnswer from "../util/migration/userAnswerSpec"

const handlePrivateSpecMigration = (quiz: PrivateSpecQuiz | Quiz): PrivateSpecQuiz => {
  if (isOldQuiz(quiz)) {
    return migratePrivateSpecQuiz(quiz as Quiz)
  }
  return quiz as PrivateSpecQuiz
}

const handleUserAnswerMigration = (
  privateSpecQuiz: PrivateSpecQuiz,
  quizAnswer: UserAnswer | QuizAnswer,
): UserAnswer => {
  if (isOldUserAnswer(quizAnswer)) {
    return (
      migrateQuizAnswer(quizAnswer as QuizAnswer, privateSpecQuiz) ?? (quizAnswer as UserAnswer)
    )
  }
  return quizAnswer as UserAnswer
}

export { handlePrivateSpecMigration, handleUserAnswerMigration }
