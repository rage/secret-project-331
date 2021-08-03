import produce from "immer"
import { createReducer } from "typesafe-actions"

import { action, NormalizedQuestion } from "../../../types/NormalizedQuiz"
import { Question } from "../../../types/Quiz"
import { initializedEditor } from "../editorActions"
import { deletePeerReview } from "../peerReviewCollections/peerReviewCollectionActions"

import {
  createdNewPeerReviewQuestion,
  decreasedPRQOrder,
  deletedPRQ,
  editedPeerReviewQuestionBody,
  editedPeerReviewQuestionTitle,
  editedPeerReviewQuestionType,
  increasedPRQOrder,
  toggledQuestionAnswerRequired,
  toggledQuestionDefault,
} from "./questionActions"

export const questionReducer = createReducer<
  {
    [quetionId: string]: Question
  },
  action
>({})
  .handleAction(initializedEditor, (_state, action) => action.payload.normalizedQuiz.questions)

  .handleAction(editedPeerReviewQuestionTitle, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.prqId].title = action.payload.newTitle
    })
  })

  .handleAction(editedPeerReviewQuestionBody, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.prqId].body = action.payload.newBody
    })
  })

  .handleAction(editedPeerReviewQuestionType, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.prqId].type = action.payload.newType
    })
  })

  .handleAction(increasedPRQOrder, (state, action) => {
    return produce(state, (draftState) => {
      const order = draftState[action.payload.prqId].order
      if (order < Object.keys(state).length - 1) {
        for (const key in state) {
          if (state[key].order - 1 === order) {
            draftState[key].order = state[key].order - 1
          }
        }
        draftState[action.payload.prqId].order = state[action.payload.prqId].order + 1
      }
    })
  })

  .handleAction(decreasedPRQOrder, (state, action) => {
    return produce(state, (draftState) => {
      const order = draftState[action.payload.prqId].order
      if (order > 0) {
        for (const key in state) {
          if (state[key].order + 1 === order) {
            draftState[key].order = state[key].order + 1
          }
        }
        draftState[action.payload.prqId].order = state[action.payload.prqId].order - 1
      }
    })
  })

  .handleAction(createdNewPeerReviewQuestion, (state, action) => {
    return produce(state, (draftState) => {
      const order = Object.values(state).filter(
        (question) => question.peerReviewCollectionId === action.payload.peerReviewCollectionId,
      ).length
      const newPRQ: NormalizedQuestion = {
        id: action.payload.newId,
        quizId: action.payload.quizId,
        peerReviewCollectionId: action.payload.peerReviewCollectionId,
        title: "",
        body: "",
        type: action.payload.type,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        default: false,
        answerRequired: true,
        order: order,
      }
      draftState[action.payload.newId] = newPRQ
    })
  })

  .handleAction(toggledQuestionDefault, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.questionId].default = action.payload.questionDefault
    })
  })

  .handleAction(toggledQuestionAnswerRequired, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.questionId].answerRequired = action.payload.answerRequired
    })
  })

  .handleAction(deletePeerReview, (state, action) => {
    return produce(state, (draftState) => {
      for (const key in draftState) {
        if (draftState[key].peerReviewCollectionId === action.payload.peerReviewId) {
          delete draftState[key]
        }
      }
    })
  })

  .handleAction(deletedPRQ, (state, action) => {
    return produce(state, (draftState) => {
      delete draftState[action.payload.questionId]
    })
  })
