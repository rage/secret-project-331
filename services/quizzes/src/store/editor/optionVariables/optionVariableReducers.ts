import { produce } from "immer"
import { createReducer } from "typesafe-actions"

import { action, QuizItemOptionVariables } from "../../../../types/types"
import {
  createdNewOption,
  createdNewQuiz,
  deletedOption,
  initializedEditor,
} from "../editorActions"

import { setOptionEditing } from "./optionVariableActions"

export const optionVariableReducers = createReducer<
  { [optionId: string]: QuizItemOptionVariables },
  action
>({})
  .handleAction(initializedEditor, (state, action) => {
    return produce(state, (draftState) => {
      if (action.payload.normalizedQuiz.options) {
        for (const [id] of Object.entries(action.payload.normalizedQuiz.options)) {
          draftState[id] = { optionEditing: false }
        }
      }
    })
  })

  .handleAction(setOptionEditing, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.optionId].optionEditing = action.payload.editing
    })
  })

  .handleAction(createdNewOption, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.optionId] = {
        optionEditing: false,
      }
    })
  })

  .handleAction(deletedOption, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.optionId].optionEditing = false
      delete draftState[action.payload.optionId]
    })
  })

  .handleAction(createdNewQuiz, (_state, _action) => {
    return {}
  })
