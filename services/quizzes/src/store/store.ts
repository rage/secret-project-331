import { TypedUseSelectorHook, useSelector } from "react-redux"
import { combineReducers, createStore } from "redux"
import { composeWithDevTools } from "redux-devtools-extension"

import {
  ItemVariables,
  NormalizedItem,
  NormalizedOption,
  NormalizedPeerReviewCollection,
  NormalizedQuestion,
  NormalizedQuiz,
  OptionVariables,
  peerReviewVariables,
  QuizVariables,
} from "../types/NormalizedQuiz"

import editorChangesReducer from "./editor/editorReducer"
import { itemVariableReducers } from "./editor/itemVariables/itemVariableReducers"
import { itemReducer } from "./editor/items/itemReducer"
import { optionVariableReducers } from "./editor/optionVariables/optionVariableReducers"
import { optionReducer } from "./editor/options/optionReducer"
import { peerReviewReducer } from "./editor/peerReviewCollections/peerReviewCollectionReducer"
import { peerReviewVariablesReducer } from "./editor/peerReviewVariables/peerReviewCollectionsVariablesReducer"
import { questionReducer } from "./editor/questions/questionReducer"
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
  editorChanges: editorChangesReducer,
  peerReviewCollections: peerReviewReducer,
  questions: questionReducer,
  peerReviewCollectionVariables: peerReviewVariablesReducer,
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
    editorChanges: { changes: boolean }
    peerReviewCollections: {
      [peerReviewCollectionId: string]: NormalizedPeerReviewCollection
    }
    questions: { [questionId: string]: NormalizedQuestion }
    peerReviewCollectionVariables: {
      [peerReviewCollectionId: string]: peerReviewVariables
    }
  }
}

export const useTypedSelector: TypedUseSelectorHook<storeState> = useSelector

export default store
