/* eslint-disable i18next/no-literal-string */
import { TypedUseSelectorHook, useSelector } from "react-redux"
import { applyMiddleware, combineReducers, createStore, Middleware } from "redux"
import { composeWithDevTools } from "redux-devtools-extension"

import {
  NormalizedQuiz,
  NormalizedQuizItem,
  NormalizedQuizItemOption,
  NormalizedQuizItemTimelineItem,
  QuizItemOptionVariables,
  QuizItemVariables,
  QuizVariables,
} from "../../types/types"

import { itemVariableReducers } from "./editor/itemVariables/itemVariableReducers"
import { itemReducer } from "./editor/items/itemReducer"
import { optionVariableReducers } from "./editor/optionVariables/optionVariableReducers"
import { optionReducer } from "./editor/options/optionReducer"
import { quizReducer } from "./editor/quiz/quizReducer"
import { quizVariableReducers } from "./editor/quizVariables/quizVariableReducers"
import { resultReducer } from "./editor/result/resultReducer"
import timelineItemReducer from "./editor/timelineItems/timelineItemsReducer"

interface EditorState {
  quizzes: { [quizId: string]: NormalizedQuiz }
  items: { [itemId: string]: NormalizedQuizItem }
  options: { [optionId: string]: NormalizedQuizItemOption }
  quizId: string
  itemVariables: { [itemId: string]: QuizItemVariables }
  optionVariables: { [optionId: string]: QuizItemOptionVariables }
  quizVariables: { [quizId: string]: QuizVariables }
  timelineItems: { [timelineItemId: string]: NormalizedQuizItemTimelineItem }
}

const editorReducer = combineReducers<EditorState>({
  quizzes: quizReducer,
  items: itemReducer,
  options: optionReducer,
  quizId: resultReducer,
  itemVariables: itemVariableReducers,
  optionVariables: optionVariableReducers,
  quizVariables: quizVariableReducers,
  timelineItems: timelineItemReducer,
})

const reducer = combineReducers({
  editor: editorReducer,
})
export interface StoreState {
  editor: EditorState
}

const loggerMiddleware: Middleware<Record<string, unknown>, StoreState> =
  (store) => (next) => (action) => {
    console.groupCollapsed(`Dispatching action ${action.type}`)
    console.groupCollapsed("Action")
    console.log(JSON.stringify(action, undefined, 2))
    console.groupEnd()
    const result = next(action)
    console.groupCollapsed("Next state")
    console.log(JSON.stringify(store.getState(), undefined, 2))
    console.groupEnd()
    console.groupEnd()
    return result
  }
const middlewares = [loggerMiddleware]
const middlewareEnhancer = applyMiddleware(...middlewares)
const store = createStore(reducer, composeWithDevTools(middlewareEnhancer))

export const useTypedSelector: TypedUseSelectorHook<StoreState> = useSelector

export default store
