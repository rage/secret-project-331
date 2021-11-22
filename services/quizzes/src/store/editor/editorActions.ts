import { createAction } from "typesafe-actions"
import { v4 } from "uuid"

import { Entities, Quiz } from "../../../types/types"

export const initializedEditor = createAction(
  "INITIALIZED_EDITOR",
  (normalizedQuiz: Entities, nestedQuiz: Quiz) => ({
    normalizedQuiz: normalizedQuiz,
    nestedQuiz: nestedQuiz,
  }),
)<{ normalizedQuiz: Entities; nestedQuiz: Quiz }>()

export const createdNewItem = createAction("CREATED_NEW_ITEM", (quizId: string, type: string) => ({
  quizId: quizId,
  type: type,
  itemId: v4(),
}))<{ quizId: string; type: string; itemId: string }>()

export const deletedItem = createAction("DELETED_ITEM", (itemId: string, quizId: string) => ({
  itemId: itemId,
  quizId: quizId,
}))<{ itemId: string; quizId: string }>()

export const createdNewOption = createAction(
  "CREATED_NEW_OPTION",
  (itemId: string, text?: string, column?: number, row?: number) => ({
    itemId: itemId,
    optionId: v4(),
    body: text,
    column: column ?? null,
    row: row ?? null,
  }),
)<{ itemId: string; optionId: string; body: string; column: number; row: number }>()

export const deletedOption = createAction("DELETED_OPTION", (optionId: string, itemId: string) => ({
  optionId: optionId,
  itemId: itemId,
}))<{ optionId: string; itemId: string }>()

export const createdNewQuiz = createAction("CREATED_NEW_QUIZ", (courseId: string) => ({
  courseId: courseId,
  quizId: v4(),
}))<{ courseId: string; quizId: string }>()
