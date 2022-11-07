import produce from "immer"
import { normalize } from "normalizr"
import { createReducer } from "typesafe-actions"

import { action, NormalizedQuiz, Quiz } from "../../../../types/types"
import { normalizedQuiz } from "../../../schemas"
import {
  createdDuplicateItem,
  createdNewItem,
  createdNewQuiz,
  deletedItem,
  initializedEditor,
} from "../editorActions"

import {
  editedQuizTitle,
  editedQuizTriesLimited,
  editedQuizzesAutoconfirm,
  editedQuizzesBody,
  editedQuizzesDeadline,
  editedQuizzesDirection,
  editedQuizzesNumberOfTries,
  editedQuizzesPart,
  editedQuizzesPointsGrantingPolicy,
  editedQuizzesPointsToGain,
  editedQuizzesSection,
  editedQuizzesSubmitmessage,
} from "./quizActions"

export const quizReducer = createReducer<{ [quizId: string]: NormalizedQuiz }, action>({})
  .handleAction(initializedEditor, (_state, action) => action.payload.normalizedQuiz.quizzes)

  .handleAction(editedQuizTitle, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.id].title = action.payload.title
    })
  })

  .handleAction(editedQuizzesNumberOfTries, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.id].tries = action.payload.numberOfTries
    })
  })

  .handleAction(editedQuizTriesLimited, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.id].triesLimited = action.payload.triesLimited
    })
  })

  .handleAction(editedQuizzesPointsToGain, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.id].points = action.payload.pointsToGain
    })
  })

  .handleAction(editedQuizzesPointsGrantingPolicy, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.id].grantPointsPolicy = action.payload.policy
    })
  })

  .handleAction(editedQuizzesDeadline, (state, action) => {
    return produce(state, (draftState) => {
      if (action.payload.deadline !== null) {
        draftState[action.payload.id].deadline = action.payload.deadline
      }
    })
  })

  .handleAction(editedQuizzesDirection, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.id].direction = action.payload.direction
    })
  })

  .handleAction(editedQuizzesBody, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].body = action.payload.newBody
    })
  })

  .handleAction(editedQuizzesSubmitmessage, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].submitMessage = action.payload.newMessage
    })
  })

  .handleAction(createdNewItem, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].items.push(action.payload.itemId)
    })
  })

  .handleAction(createdDuplicateItem, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].items.push(action.payload.itemId)
    })
  })

  .handleAction(deletedItem, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].items = draftState[action.payload.quizId].items.filter(
        (id) => id !== action.payload.itemId,
      )
    })
  })

  .handleAction(createdNewQuiz, (_state, action) => {
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
      direction: "column",
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

    const normalized = normalize(init, normalizedQuiz)

    return normalized.entities.quizzes ?? {}
  })

  .handleAction(editedQuizzesPart, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].part = action.payload.newPart
    })
  })

  .handleAction(editedQuizzesSection, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].section = action.payload.newSection
    })
  })

  .handleAction(editedQuizzesAutoconfirm, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.quizId].autoConfirm = action.payload.autoConfirm
    })
  })

export default quizReducer
