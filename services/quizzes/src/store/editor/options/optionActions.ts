import { createAction } from "typesafe-actions"

export const editedOptionTitle = createAction(
  "EDITED_OPTION_TITLE",
  (newTitle: string, optionId: string) => ({
    newTitle: newTitle,
    optionId: optionId,
  }),
)<{ newTitle: string; optionId: string }>()

export const editedOptionCorrectness = createAction(
  "EDITED_OPTION_CORRECTNESS",
  (optionId: string, correct: boolean) => ({
    optionId: optionId,
    correct: correct,
  }),
)<{ optionId: string; correct: boolean }>()

export const editedOptionAfterSubmissionSelectedMessage = createAction(
  "EDITED_OPTION_AFTER_SUBMISSION_SELECTED_MESSAGE",
  (optionId: string, newMessage: string) => ({ optionId, newMessage }),
)<{ optionId: string; newMessage: string }>()

export const editedOptionAdditionalCorrectnessExplanationOnModelSolution = createAction(
  "EDITED_OPTION_ADDITIONAL_CORRECTNESS_EXPLANATION_ON_MODEL_SOLUTION",
  (optionId: string, newMessage: string) => ({ optionId, newMessage }),
)<{ optionId: string; newMessage: string }>()

export const optionActions = [
  editedOptionTitle,
  editedOptionCorrectness,
  editedOptionAfterSubmissionSelectedMessage,
  editedOptionAdditionalCorrectnessExplanationOnModelSolution,
]

export default optionActions
