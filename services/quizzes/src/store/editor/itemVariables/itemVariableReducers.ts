import produce from "immer"
import _ from "lodash"
import { createReducer } from "typesafe-actions"

import { action, QuizItemVariables } from "../../../../types/types"
import {
  createdNewItem,
  createdNewOption,
  createdNewQuiz,
  deletedItem,
  initializedEditor,
} from "../editorActions"

import {
  setAdvancedEditing,
  setFormatRegexTestAnswer,
  setFormatTestRegex,
  setFormatValidityRegex,
  setScaleMax,
  setScaleMin,
  setValidityRegexTestAnswer,
  setValidityTestRegex,
  setValidValidityRegex,
  toggleFormatRegexTestingState,
  toggleValidRegexTestingState,
} from "./itemVariableActions"

export const itemVariableReducers = createReducer<{ [itemId: string]: QuizItemVariables }, action>(
  {},
)
  .handleAction(initializedEditor, (state, action) => {
    return produce(state, (draftState) => {
      for (const [id, item] of Object.entries(action.payload.normalizedQuiz.items)) {
        let array: number[] = []
        if (item.minValue && item.maxValue) {
          array = _.range(item.minValue, item.maxValue + 1)
        }
        draftState[id] = {
          scaleMax: item.maxValue ?? 0,
          scaleMin: item.minValue ?? 0,
          validMax: true,
          validMin: true,
          array: array,
          advancedEditing: false,
          testingRegex: false,
          testingFormatRegex: false,
          regex: item.validityRegex ?? "",
          formatRegex: item.formatRegex ?? "",
          validityRegexTestAnswer: "",
          formatRegexTestAnswer: "",
          validRegex: true,
          validFormatRegex: true,
          newOptions: [],
          textValue: "",
        }
      }
    })
  })

  .handleAction(setAdvancedEditing, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].advancedEditing = action.payload.editing
    })
  })

  .handleAction(setScaleMax, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].scaleMax = action.payload.newValue
      draftState[action.payload.itemId].validMax = action.payload.valid
      if (action.payload.valid) {
        draftState[action.payload.itemId].array = _.range(
          state[action.payload.itemId].scaleMin ?? 0,
          action.payload.newValue + 1,
        )
      }
    })
  })

  .handleAction(setScaleMin, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].scaleMin = action.payload.newValue
      draftState[action.payload.itemId].validMin = action.payload.valid
      if (action.payload.valid) {
        draftState[action.payload.itemId].array = _.range(
          action.payload.newValue,
          (state[action.payload.itemId].scaleMax ?? 0) + 1,
        )
      }
    })
  })

  .handleAction(toggleValidRegexTestingState, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].testingRegex = action.payload.testing
    })
  })

  .handleAction(toggleFormatRegexTestingState, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].testingFormatRegex = action.payload.testing
    })
  })

  .handleAction(setValidityTestRegex, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].regex = action.payload.testRegex
    })
  })

  .handleAction(setFormatTestRegex, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].formatRegex = action.payload.testRegex
    })
  })

  .handleAction(setValidityRegexTestAnswer, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].validityRegexTestAnswer = action.payload.testAnswer
    })
  })

  .handleAction(setFormatRegexTestAnswer, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].formatRegexTestAnswer = action.payload.testAnswer
    })
  })

  .handleAction(setValidValidityRegex, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].validRegex = action.payload.valid
    })
  })

  .handleAction(setFormatValidityRegex, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].validFormatRegex = action.payload.valid
    })
  })

  .handleAction(createdNewItem, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId] = {
        advancedEditing: false,
        regex: "",
        formatRegex: "",
        validityRegexTestAnswer: "",
        formatRegexTestAnswer: "",
        scaleMax: 0,
        scaleMin: 0,
        testingRegex: false,
        testingFormatRegex: false,
        validMax: true,
        validMin: true,
        validRegex: true,
        validFormatRegex: true,
        array: [],
        newOptions: [],
        textValue: "",
      }
    })
  })

  .handleAction(deletedItem, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].advancedEditing = false
      delete draftState[action.payload.itemId]
    })
  })

  .handleAction(createdNewOption, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.itemId].newOptions.push(action.payload.optionId)
    })
  })

  .handleAction(createdNewQuiz, (_state, _action) => {
    return {}
  })
