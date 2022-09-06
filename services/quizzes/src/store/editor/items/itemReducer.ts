import produce from "immer"
import { normalize } from "normalizr"
import { createReducer } from "typesafe-actions"

import { action, NormalizedQuizItem, Quiz } from "../../../../types/types"
import { normalizedQuiz } from "../../../schemas"
import {
  createdDuplicateItem,
  createdNewItem,
  createdNewOption,
  createdNewQuiz,
  deletedItem,
  deletedOption,
  initializedEditor,
} from "../editorActions"
import {
  addedTimelineItemAction,
  deleteTimelineItemEventAction,
} from "../timelineItems/timelineItemsActions"

import {
  decreasedItemOrder,
  editedFormatRegex,
  editedItemDirection,
  editedItemFailureMessage,
  editedItemMaxWords,
  editedItemMinWords,
  editedItemSuccessMessage,
  editedMultipleChoiceMultipleOptionsGradingPolicy,
  editedQuizItemBody,
  editedQuizItemOptionCells,
  editedQuizItemTitle,
  editedScaleMaxValue,
  editedScaleMinValue,
  editedSharedOptionsFeedbackMessage,
  editedValidityRegex,
  increasedItemOrder,
  toggledAllAnswersCorrect,
  toggledMultiOptions,
  toggledSharedOptionFeedbackMessage,
  toggledShuffleOptions,
} from "./itemAction"

export const itemReducer = createReducer<{ [itemId: string]: NormalizedQuizItem }, action>({})
  .handleAction(initializedEditor, (_state, action) => action.payload.normalizedQuiz.items)

  .handleAction(editedQuizItemBody, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.id].body = action.payload.body
    })
  })

  .handleAction(editedQuizItemTitle, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.id].title = action.payload.title
    })
  })

  .handleAction(editedScaleMaxValue, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].maxValue = action.payload.newValue
    })
  })

  .handleAction(editedScaleMinValue, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].minValue = action.payload.newValue
    })
  })

  .handleAction(editedValidityRegex, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].validityRegex = action.payload.newRegex
    })
  })

  .handleAction(editedFormatRegex, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].formatRegex = action.payload.newRegex
    })
  })

  .handleAction(toggledMultiOptions, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].multi = !state[action.payload.itemId].multi
    })
  })

  .handleAction(editedItemSuccessMessage, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].successMessage = action.payload.newMessage
    })
  })

  .handleAction(editedItemFailureMessage, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].failureMessage = action.payload.newMessage
    })
  })

  .handleAction(editedItemMaxWords, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].maxWords = action.payload.maxWords
    })
  })

  .handleAction(editedItemMinWords, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].minWords = action.payload.minWords
    })
  })

  .handleAction(editedSharedOptionsFeedbackMessage, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].sharedOptionFeedbackMessage = action.payload.newMessage
    })
  })

  .handleAction(toggledSharedOptionFeedbackMessage, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].usesSharedOptionFeedbackMessage =
        action.payload.sharedFeedback
    })
  })

  .handleAction(toggledShuffleOptions, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].shuffleOptions = action.payload.shuffleOptions
    })
  })

  .handleAction(editedMultipleChoiceMultipleOptionsGradingPolicy, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].multipleChoiceMultipleOptionsGradingPolicy =
        action.payload.multipleChoiceMultipleOptionsGradingPolicy
    })
  })

  .handleAction(createdNewItem, (state, action) => {
    return produce(state, (draftState) => {
      const newItem: NormalizedQuizItem = {
        id: action.payload.itemId,
        quizId: action.payload.quizId,
        type: action.payload.type,
        title: "",
        body: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        successMessage: null,
        failureMessage: null,
        formatRegex: null,
        validityRegex: null,
        maxValue: null,
        minValue: null,
        maxWords: null,
        minWords: null,
        multi: false,
        order: Object.keys(state).length,
        usesSharedOptionFeedbackMessage: false,
        sharedOptionFeedbackMessage: null,
        options: [],
        optionCells: null,
        allAnswersCorrect: false,
        direction: "column",
        timelineItems: [],
        shuffleOptions: false,
        multipleChoiceMultipleOptionsGradingPolicy: "default",
      }
      draftState[action.payload.itemId] = newItem
    })
  })

  .handleAction(createdDuplicateItem, (state, action) => {
    return produce(state, (draftState) => {
      const oldItem = action.payload.storeItem
      const newItem: NormalizedQuizItem = {
        id: action.payload.itemId,
        quizId: action.payload.quizId,
        type: oldItem.type,
        title: oldItem.title,
        body: oldItem.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        successMessage: oldItem.successMessage,
        failureMessage: oldItem.failureMessage,
        formatRegex: oldItem.formatRegex,
        validityRegex: oldItem.validityRegex,
        maxValue: oldItem.maxValue,
        minValue: oldItem.minValue,
        maxWords: oldItem.maxWords,
        minWords: oldItem.minWords,
        multi: oldItem.multi,
        order: Object.keys(state).length,
        usesSharedOptionFeedbackMessage: oldItem.usesSharedOptionFeedbackMessage,
        sharedOptionFeedbackMessage: oldItem.sharedOptionFeedbackMessage,
        options: oldItem.options,
        optionCells: oldItem.optionCells,
        allAnswersCorrect: oldItem.allAnswersCorrect,
        direction: oldItem.direction,
        timelineItems: oldItem.timelineItems,
        shuffleOptions: oldItem.shuffleOptions ?? false,
        multipleChoiceMultipleOptionsGradingPolicy: "default",
      }
      draftState[action.payload.itemId] = newItem
    })
  })

  .handleAction(deletedItem, (state, action) => {
    return produce(state, (draftState) => {
      const deletedOrder = state[action.payload.itemId].order
      delete draftState[action.payload.itemId]
      for (const key in draftState) {
        if (draftState[key].order > deletedOrder) {
          draftState[key].order = draftState[key].order - 1
        }
      }
    })
  })

  .handleAction(createdNewOption, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].options.push(action.payload.optionId)
    })
  })

  .handleAction(deletedOption, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].options = draftState[action.payload.itemId].options.filter(
        (optionId) => optionId !== action.payload.optionId,
      )
    })
  })

  .handleAction(createdNewQuiz, (_state, action) => {
    const init: Quiz = {
      id: action.payload.quizId,
      autoConfirm: false,
      autoReject: false,
      awardPointsEvenIfWrong: false,
      body: "",
      courseId: action.payload.courseId,
      createdAt: new Date(),
      updatedAt: new Date(),
      deadline: null,
      excludedFromScore: false,
      grantPointsPolicy: "grant_whenever_possible",
      items: [],
      open: null,
      part: 0,
      points: 1,
      section: 0,
      submitMessage: null,
      title: "",
      tries: 1,
      triesLimited: true,
    }

    const normalized = normalize(init, normalizedQuiz)
    return normalized.entities.items ?? {}
  })

  .handleAction(increasedItemOrder, (state, action) => {
    return produce(state, (draftState) => {
      const order = draftState[action.payload.itemId].order
      if (order < Object.keys(state).length - 1) {
        for (const key in state) {
          if (state[key].order - 1 === order) {
            draftState[key].order = state[key].order - 1
          }
        }
        draftState[action.payload.itemId].order = state[action.payload.itemId].order + 1
      }
    })
  })

  .handleAction(decreasedItemOrder, (state, action) => {
    return produce(state, (draftState) => {
      const order = draftState[action.payload.itemId].order
      if (order > 0) {
        for (const key in state) {
          if (state[key].order + 1 === order) {
            draftState[key].order = state[key].order + 1
          }
        }
        draftState[action.payload.itemId].order = state[action.payload.itemId].order - 1
      }
    })
  })

  .handleAction(toggledAllAnswersCorrect, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].allAnswersCorrect =
        !draftState[action.payload.itemId].allAnswersCorrect
    })
  })

  .handleAction(editedItemDirection, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].direction = action.payload.newDirection
    })
  })

  .handleAction(editedQuizItemOptionCells, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].optionCells = action.payload.optionCells
    })
  })

  .handleAction(addedTimelineItemAction, (state, action) => {
    return produce(state, (draftState) => {
      if (!draftState[action.payload.quizItemId].timelineItems) {
        draftState[action.payload.quizItemId].timelineItems = []
      }
      draftState[action.payload.quizItemId].timelineItems.push(action.payload.timelineItemId)
    })
  })

  .handleAction(deleteTimelineItemEventAction, (state, action) => {
    return produce(state, (draftState) => {
      const timelineItems = draftState[action.payload.quizItemId].timelineItems
      draftState[action.payload.quizItemId].timelineItems = timelineItems.filter(
        (id) => id !== action.payload.timelineItemId,
      )
    })
  })

export default itemReducer
