import produce from "immer"
import { createReducer } from "typesafe-actions"

import { action, Quiz, QuizVariables } from "../../../../types/types"
import {
  createdDuplicateItem,
  createdNewItem,
  createdNewQuiz,
  initializedEditor,
} from "../editorActions"
import { editedQuizzesDeadline } from "../quiz/quizActions"

import { setAddNewQuizItem, setNewItemType } from "./quizVariableActions"

export const quizVariableReducers = createReducer<{ [quizId: string]: QuizVariables }, action>({})
  .handleAction(initializedEditor, (state, action) => {
    return produce(state, (draftState) => {
      const init = { ...action.payload.nestedQuiz }
      const deadline =
        action.payload.normalizedQuiz.quizzes[action.payload.normalizedQuiz.result].deadline

      draftState[action.payload.normalizedQuiz.result] = {
        initialState: init,
        addingNewItem: false,
        newItemType: "",
        newItems: [],
        deadline: deadline,
        validDeadline: true,
        newQuiz: false,
      }
    })
  })

  .handleAction(createdNewQuiz, (state, action) => {
    return produce(state, (draftState) => {
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
      draftState[action.payload.quizId] = {
        initialState: init,
        addingNewItem: false,
        newItemType: "",
        newItems: [],
        newQuiz: true,
        deadline: null,
        validDeadline: true,
      }
    })
  })

  .handleAction(setAddNewQuizItem, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].addingNewItem = action.payload.adding
    })
  })

  .handleAction(setNewItemType, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].newItemType = action.payload.type
    })
  })

  .handleAction(createdNewItem, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].newItems.push(action.payload.itemId)
    })
  })

  .handleAction(createdDuplicateItem, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].newItems.push(action.payload.itemId)
    })
  })

  .handleAction(editedQuizzesDeadline, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.id].deadline = action.payload.deadline
    })
  })
