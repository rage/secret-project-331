import { createAction } from "typesafe-actions"

import { MultipleChoiceGradingPolicy } from "../../../../types/types"

export const editedQuizItemBody = createAction(
  "EDITED_QUIZ_ITEM_BODY",
  (newBody: string, itemId: string) => ({ body: newBody, id: itemId }),
)<{ body: string; id: string }>()

export const editedQuizItemTitle = createAction(
  "EDITED_QUIZ_ITEM_TITLE",
  (newTitle: string, itemId: string) => ({ title: newTitle, id: itemId }),
)<{ title: string; id: string }>()

export const editedScaleMaxValue = createAction(
  "EDITED_SCALE_MAX_VALUE",
  (itemId: string, newValue: number) => ({
    itemId: itemId,
    newValue: newValue,
  }),
)<{ itemId: string; newValue: number }>()

export const editedScaleMinValue = createAction(
  "EDITED_SCALE_MIN_VALUE",
  (itemId: string, newValue: number) => ({
    itemId: itemId,
    newValue: newValue,
  }),
)<{ itemId: string; newValue: number }>()

export const editedScaleMaxLabel = createAction(
  "EDITED_SCALE_MAX_LABEL",
  (itemId: string, newLabel: string) => ({
    itemId: itemId,
    newLabel: newLabel,
  }),
)<{ itemId: string; newLabel: string }>()

export const editedScaleMinLabel = createAction(
  "EDITED_SCALE_MIN_LABEL",
  (itemId: string, newLabel: string) => ({
    itemId: itemId,
    newLabel: newLabel,
  }),
)<{ itemId: string; newLabel: string }>()

export const editedValidityRegex = createAction(
  "EDITED_VALIDITY_REGEX",
  (itemId: string, newRegex: string) => ({
    itemId: itemId,
    newRegex: newRegex,
  }),
)<{ itemId: string; newRegex: string }>()

export const editedFormatRegex = createAction(
  "EDITED_FORMAT_REGEX",
  (itemId: string, newRegex: string) => ({
    itemId: itemId,
    newRegex: newRegex,
  }),
)<{ itemId: string; newRegex: string }>()

export const toggledMultiOptions = createAction(
  "TOGGLED_MULTI_OPTIONS",
  (itemId: string, checked: boolean) => ({
    itemId: itemId,
    checked: checked,
  }),
)<{ itemId: string; checked: boolean }>()

export const editedItemSuccessMessage = createAction(
  "EDITED_ITEM_SUCCESS_MESSAGE",
  (itemId: string, newMessage: string) => ({
    itemId: itemId,
    newMessage: newMessage,
  }),
)<{ itemId: string; newMessage: string }>()

export const editedItemFailureMessage = createAction(
  "EDITED_ITEM_FAILURE_MESSAGE",
  (itemId: string, newMessage: string) => ({
    itemId: itemId,
    newMessage: newMessage,
  }),
)<{ itemId: string; newMessage: string }>()

export const editedItemMaxWords = createAction(
  "EDITED_ITEM_MAX_WORDS",
  (itemId: string, maxWords: number) => ({
    itemId: itemId,
    maxWords: maxWords,
  }),
)<{ itemId: string; maxWords: number }>()

export const editedItemMinWords = createAction(
  "EDITED_ITEM_MIN_WORDS",
  (itemId: string, minWords: number) => ({
    itemId: itemId,
    minWords: minWords,
  }),
)<{ itemId: string; minWords: number }>()

export const editedSharedOptionsFeedbackMessage = createAction(
  "EDITED_SHARED_OPTION_MESSAGE",
  (itemId: string, newMessage: string) => ({
    itemId: itemId,
    newMessage: newMessage,
  }),
)<{ itemId: string; newMessage: string }>()

export const toggledSharedOptionFeedbackMessage = createAction(
  "TOGGLED_SHARED_OPTION_MESSAGE",
  (itemId: string, sharedFeedback: boolean) => ({
    itemId: itemId,
    sharedFeedback: sharedFeedback,
  }),
)<{ itemId: string; sharedFeedback: boolean }>()

export const editedMultipleChoiceGradingPolicy = createAction(
  "SET_MULTIPLE_CHOICE_GRADING_POLICY",
  (itemId: string, multipleChoiceGradingPolicy: MultipleChoiceGradingPolicy) => ({
    itemId,
    multipleChoiceGradingPolicy,
  }),
)<{ itemId: string; multipleChoiceGradingPolicy: MultipleChoiceGradingPolicy }>()

export const toggledShuffleOptions = createAction(
  "TOGGLED_RANDOMIZED_OPTIONS",
  (itemId: string, shuffleOptions: boolean) => ({
    itemId: itemId,
    shuffleOptions: shuffleOptions,
  }),
)<{ itemId: string; shuffleOptions: boolean }>()

export const decreasedItemOrder = createAction("DECREASED_ITEM_ORDER", (itemId: string) => ({
  itemId: itemId,
}))<{ itemId: string }>()

export const increasedItemOrder = createAction("INCREASED_ITEM_ORDER", (itemId: string) => ({
  itemId: itemId,
}))<{ itemId: string }>()

export const toggledAllAnswersCorrect = createAction(
  "TOGGLED_ALL_ANSWERS_CORRECT",
  (itemId: string) => ({ itemId: itemId }),
)<{ itemId: string }>()

export const editedItemDirection = createAction(
  "EDITED_ITEM_DIRECTION",
  (itemId: string, newDirection) => ({ itemId, newDirection }),
)<{ itemId: string; newDirection: "row" | "column" }>()

export const editedQuizItemOptionCells = createAction(
  "EDITED_OPTION_CELLS",
  (itemId: string, newOptionCells: string[][]) => ({
    itemId: itemId,
    optionCells: newOptionCells,
  }),
)<{ itemId: string; optionCells: string[][] }>()

export const itemActions = [
  editedQuizItemBody,
  editedQuizItemTitle,
  editedScaleMaxValue,
  editedScaleMinValue,
  editedScaleMaxLabel,
  editedScaleMinLabel,
  editedValidityRegex,
  editedFormatRegex,
  toggledMultiOptions,
  editedItemSuccessMessage,
  editedItemFailureMessage,
  editedItemMaxWords,
  editedItemMinWords,
  editedSharedOptionsFeedbackMessage,
  toggledSharedOptionFeedbackMessage,
  decreasedItemOrder,
  increasedItemOrder,
  toggledAllAnswersCorrect,
  toggledShuffleOptions,
  editedMultipleChoiceGradingPolicy,
  editedItemDirection,
  editedQuizItemOptionCells,
]

export default itemActions
