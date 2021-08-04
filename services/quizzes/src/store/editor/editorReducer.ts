import produce from "immer"
import _ from "lodash"
import { denormalize } from "normalizr"
import { createReducer } from "typesafe-actions"

import { normalizedQuiz } from "../../schemas"
import { action, Quiz } from "../../types/types"

import { checkForChanges } from "./editorActions"

export const editorChangesReducer = createReducer<{ changes: boolean }, action>({
  changes: false,
}).handleAction(checkForChanges, (state, action) => {
  if (action.payload.store.editor.quizId !== "") {
    return produce(state, (draftState) => {
      const initState: Quiz =
        action.payload.store.editor.quizVariables[action.payload.store.editor.quizId].initialState

      const quizData = {
        quizzes: action.payload.store.editor.quizzes,
        items: action.payload.store.editor.items,
        options: action.payload.store.editor.options,
        quizId: action.payload.store.editor.quizId,
      }

      const newState: Quiz = denormalize(quizData.quizId, normalizedQuiz, quizData)

      draftState.changes = !_.isEqual(initState, newState)
    })
  } else {
    return produce(state, (draftState) => {
      draftState.changes = false
    })
  }
})

export default editorChangesReducer
