import produce from "immer"
import { DateTime } from "luxon"
import { createReducer } from "typesafe-actions"

import { action, QuizVariables } from "../../../types/NormalizedQuiz"
import { Quiz } from "../../../types/Quiz"
import { createdNewItem, createdNewQuiz, initializedEditor } from "../editorActions"
import { createdNewPeerReview } from "../peerReviewCollections/peerReviewCollectionActions"
import { editedQuizzesDeadline } from "../quiz/quizActions"

import { setAddNewQuizItem, setNewItemType } from "./quizVariableActions"

export const quizVariableReducers = createReducer<{ [quizId: string]: QuizVariables }, action>({})
  .handleAction(initializedEditor, (state, action) => {
    return produce(state, (draftState) => {
      const init = { ...action.payload.nestedQuiz }
      const deadline =
        action.payload.normalizedQuiz.quizzes[action.payload.normalizedQuiz.result].deadline

      let withOffset = ""
      if (deadline) {
        withOffset = DateTime.fromISO(deadline).toLocal().toISO()
      }
      draftState[action.payload.normalizedQuiz.result] = {
        initialState: init,
        addingNewItem: false,
        newItemType: "",
        newItems: [],
        deadline: withOffset,
        validDeadline: true,
        newQuiz: false,
        newPeerReviews: [],
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
        peerReviewCollections: [],
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
        deadline: "",
        validDeadline: true,
        newPeerReviews: [],
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

  .handleAction(editedQuizzesDeadline, (state, action) => {
    return produce(state, (draftState) => {
      if (!action.payload.deadline) {
        draftState[action.payload.id].validDeadline = true
        draftState[action.payload.id].deadline = ""
      }
      if (action.payload.deadline !== null) {
        if (DateTime.fromISO(action.payload.deadline.toISOString()).isValid) {
          draftState[action.payload.id].validDeadline = true
          draftState[action.payload.id].deadline = DateTime.fromISO(
            action.payload.deadline.toISOString(),
          )
            .toLocal()
            .toISO()
        } else {
          draftState[action.payload.id].validDeadline = false
          draftState[action.payload.id].deadline = draftState[action.payload.id].deadline =
            DateTime.fromISO(action.payload.deadline.toISOString()).toLocal().toISO()
        }
      }
    })
  })

  .handleAction(createdNewPeerReview, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].newPeerReviews.push(action.payload.newId)
    })
  })
