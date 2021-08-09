import { TypedUseSelectorHook, useSelector } from "react-redux"
import { combineReducers, createStore } from "redux"
import { composeWithDevTools } from "redux-devtools-extension"

import {
  ItemVariables,
  NormalizedItem,
  NormalizedOption,
  NormalizedQuiz,
  OptionVariables,
  QuizVariables,
} from "../types/types"

import { itemVariableReducers } from "./editor/itemVariables/itemVariableReducers"
import { itemReducer } from "./editor/items/itemReducer"
import { optionVariableReducers } from "./editor/optionVariables/optionVariableReducers"
import { optionReducer } from "./editor/options/optionReducer"
import { quizReducer } from "./editor/quiz/quizReducer"
import { quizVariableReducers } from "./editor/quizVariables/quizVariableReducers"
import { resultReducer } from "./editor/result/resultReducer"

const editorReducer = combineReducers({
  quizzes: quizReducer,
  items: itemReducer,
  options: optionReducer,
  quizId: resultReducer,
  itemVariables: itemVariableReducers,
  optionVariables: optionVariableReducers,
  quizVariables: quizVariableReducers,
})

const reducer = combineReducers({
  editor: editorReducer,
})

const store = createStore(reducer, composeWithDevTools())

export interface storeState {
  editor: {
    quizzes: { [quizId: string]: NormalizedQuiz }
    items: { [itemId: string]: NormalizedItem }
    options: { [optionId: string]: NormalizedOption }
    quizId: string
    itemVariables: { [itemId: string]: ItemVariables }
    optionVariables: { [optionId: string]: OptionVariables }
    quizVariables: { [quizId: string]: QuizVariables }
  }
}

export const useTypedSelector: TypedUseSelectorHook<storeState> = useSelector

export default store
