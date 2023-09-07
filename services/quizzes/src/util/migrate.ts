// Allow any for this file, because we are checking for properties that no longer exist in interfaces.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Quiz, QuizItem, QuizItemOption } from "../../types/types"

export function migrateQuiz(oldQuiz: unknown): Quiz {
  console.log("Old quiz:", oldQuiz)
  return {
    ...(oldQuiz as Quiz),
    items: (oldQuiz as Quiz).items.map((x) => migrateQuizItem(x)),
  }
}

function migrateQuizItem(oldQuizItem: unknown): QuizItem {
  return {
    ...(oldQuizItem as QuizItem),
    options: (oldQuizItem as QuizItem).options.map((x) => migrateQuizItemOption(x)),
  }
}

function migrateQuizItemOption(oldQuizItemOption: unknown): QuizItemOption {
  const successMessage: string | null = (oldQuizItemOption as any).successMessage
  const failureMessage: string | null = (oldQuizItemOption as any).failureMessage
  if (successMessage === null && failureMessage === null) {
    // Nothing to migrate, avoid overriding existing feedback message.
    return oldQuizItemOption as QuizItemOption
  }
  let feedback
  if ((oldQuizItemOption as QuizItemOption).messageAfterSubmissionWhenSelected) {
    feedback = (oldQuizItemOption as QuizItemOption).messageAfterSubmissionWhenSelected
  } else {
    feedback = (oldQuizItemOption as QuizItemOption).correct ? successMessage : failureMessage
  }
  return {
    id: (oldQuizItemOption as QuizItemOption).id,
    body: (oldQuizItemOption as QuizItemOption).body,
    correct: (oldQuizItemOption as QuizItemOption).correct,
    createdAt: (oldQuizItemOption as QuizItemOption).createdAt,
    messageAfterSubmissionWhenSelected: feedback,
    additionalCorrectnessExplanationOnModelSolution:
      (oldQuizItemOption as QuizItemOption).additionalCorrectnessExplanationOnModelSolution ?? null,
    order: (oldQuizItemOption as QuizItemOption).order,
    title: (oldQuizItemOption as QuizItemOption).title,
    updatedAt: (oldQuizItemOption as QuizItemOption).updatedAt,
    quizItemId: (oldQuizItemOption as QuizItemOption).quizItemId,
  }
}
