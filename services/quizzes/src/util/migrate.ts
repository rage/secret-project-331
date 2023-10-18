// Allow any for this file, because we are checking for properties that no longer exist in interfaces.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { OldQuiz, OldQuizItemOption, QuizItem } from "../../types/oldQuizTypes"

export function migrateQuiz(oldQuiz: unknown): OldQuiz {
  console.log("Old quiz:", oldQuiz)
  return {
    ...(oldQuiz as OldQuiz),
    items: (oldQuiz as OldQuiz).items.map((x) => migrateQuizItem(x)),
  }
}

function migrateQuizItem(oldQuizItem: unknown): QuizItem {
  return {
    ...(oldQuizItem as QuizItem),
    options: (oldQuizItem as QuizItem).options.map((x) => migrateQuizItemOption(x)),
  }
}

function migrateQuizItemOption(oldQuizItemOption: unknown): OldQuizItemOption {
  const successMessage: string | null = (oldQuizItemOption as any).successMessage
  const failureMessage: string | null = (oldQuizItemOption as any).failureMessage
  if (successMessage === null && failureMessage === null) {
    // Nothing to migrate, avoid overriding existing feedback message.
    return oldQuizItemOption as OldQuizItemOption
  }
  let feedback
  if ((oldQuizItemOption as OldQuizItemOption).messageAfterSubmissionWhenSelected) {
    feedback = (oldQuizItemOption as OldQuizItemOption).messageAfterSubmissionWhenSelected
  } else {
    feedback = (oldQuizItemOption as OldQuizItemOption).correct ? successMessage : failureMessage
  }
  return {
    id: (oldQuizItemOption as OldQuizItemOption).id,
    body: (oldQuizItemOption as OldQuizItemOption).body,
    correct: (oldQuizItemOption as OldQuizItemOption).correct,
    createdAt: (oldQuizItemOption as OldQuizItemOption).createdAt,
    messageAfterSubmissionWhenSelected: feedback,
    additionalCorrectnessExplanationOnModelSolution:
      (oldQuizItemOption as OldQuizItemOption).additionalCorrectnessExplanationOnModelSolution ??
      null,
    order: (oldQuizItemOption as OldQuizItemOption).order,
    title: (oldQuizItemOption as OldQuizItemOption).title,
    updatedAt: (oldQuizItemOption as OldQuizItemOption).updatedAt,
    quizItemId: (oldQuizItemOption as OldQuizItemOption).quizItemId,
  }
}
