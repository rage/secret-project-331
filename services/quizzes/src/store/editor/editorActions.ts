import { createAction } from "typesafe-actions"
import { v4 } from "uuid"

import { Entities } from "../../types/NormalizedQuiz"
import { Quiz } from "../../types/Quiz"
import { storeState } from "../store"

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

export const createdNewOption = createAction("CREATED_NEW_OPTION", (itemId: string) => ({
  itemId: itemId,
  optionId: v4(),
}))<{ itemId: string; optionId: string }>()

export const deletedOption = createAction("DELETED_OPTION", (optionId: string, itemId: string) => ({
  optionId: optionId,
  itemId: itemId,
}))<{ optionId: string; itemId: string }>()

export const createdNewQuiz = createAction("CREATED_NEW_QUIZ", (courseId: string) => ({
  courseId: courseId,
  quizId: v4(),
}))<{ courseId: string; quizId: string }>()

export const checkForChanges = createAction("CHANGE_CHECK", (store: storeState) => ({
  store: store,
}))<{ store: storeState }>()
