import { createReducer } from "typesafe-actions"

import { action } from "../../../types/NormalizedQuiz"
import { createdNewQuiz, initializedEditor } from "../editorActions"

export const resultReducer = createReducer<string, action>("")
  .handleAction(initializedEditor, (_state, action) => action.payload.normalizedQuiz.result)
  .handleAction(createdNewQuiz, (_state, action) => action.payload.quizId)
