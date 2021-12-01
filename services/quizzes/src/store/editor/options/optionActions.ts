import { createAction } from "typesafe-actions"

export const editedOptionTitle = createAction(
  "EDITED_OPTION_TITLE",
  (newTitle: string, optionId: string) => ({
    newTitle: newTitle,
    optionId: optionId,
  }),
)<{ newTitle: string; optionId: string }>()

export const editedOptionCorrectAnswer = createAction(
  "EDITED_OPTION_CORRECT_ANSWER",
  (newCorrectAnswer: string, optionId: string) => ({
    newCorrectAnswer: newCorrectAnswer,
    optionId: optionId,
  }),
)<{ newCorrectAnswer: string; optionId: string }>()

export const editedOptionCorrectness = createAction(
  "EDITED_OPTION_CORRECTNESS",
  (optionId: string, correct: boolean) => ({
    optionId: optionId,
    correct: correct,
  }),
)<{ optionId: string; correct: boolean }>()

export const editedOptionSuccessMessage = createAction(
  "EDITED_OPTION_SUCCESS_MESSAGE",
  (optionId: string, newMessage: string) => ({
    optionId: optionId,
    newMessage: newMessage,
  }),
)<{ optionId: string; newMessage: string }>()

export const addOptionLocationToPublicQuiz = createAction(
  "ADD_OPTION_LOCATION_TO_PUBLIC_QUIZ",
  (optionId: string, column: number, row: number) => ({
    optionId: optionId,
    column: column,
    row: row,
  }),
)<{ optionId: string; column: number; row: number }>()

export const editedOptionFailureMessage = createAction(
  "EDITED_OPTION_FAILURE_MESSAGE",
  (optionId: string, newMessage: string) => ({
    optionId: optionId,
    newMessage: newMessage,
  }),
)<{ optionId: string; newMessage: string }>()

export const optionActions = [
  editedOptionTitle,
  editedOptionCorrectness,
  editedOptionSuccessMessage,
  editedOptionFailureMessage,
]

export default optionActions
