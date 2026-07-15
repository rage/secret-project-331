import { isOldQuiz, isOldUserAnswer } from "@/util/migration/migrationSettings"
import { migratePrivateSpecQuiz } from "@/util/migration/privateSpecQuiz"
import migrateQuizAnswer from "@/util/migration/userAnswerSpec"

import type { OldQuiz, OldQuizAnswer } from "../../types/oldQuizTypes"
import type { UserAnswer } from "../../types/quizTypes/answer"
import type { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"

const handlePrivateSpecMigration = (quiz: PrivateSpecQuiz | OldQuiz): PrivateSpecQuiz => {
  if (isOldQuiz(quiz)) {
    return migratePrivateSpecQuiz(quiz as OldQuiz)
  }
  return quiz as PrivateSpecQuiz
}

const handleUserAnswerMigration = (
  privateSpecQuiz: PrivateSpecQuiz,
  quizAnswer: UserAnswer | OldQuizAnswer,
): UserAnswer => {
  if (isOldUserAnswer(quizAnswer)) {
    return (
      migrateQuizAnswer(quizAnswer as OldQuizAnswer, privateSpecQuiz) ?? (quizAnswer as UserAnswer)
    )
  }
  return quizAnswer as UserAnswer
}

export { handlePrivateSpecMigration, handleUserAnswerMigration }
