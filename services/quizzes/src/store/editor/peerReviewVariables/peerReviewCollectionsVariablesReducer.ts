import produce from "immer"
import { createReducer } from "typesafe-actions"

import {
  action,
  peerReviewVariables as peerReviewCollectionVariables,
} from "../../../types/NormalizedQuiz"
import { initializedEditor } from "../editorActions"
import { createdNewPeerReview as createdNewPeerReviewCollection } from "../peerReviewCollections/peerReviewCollectionActions"
import { createdNewPeerReviewQuestion } from "../questions/questionActions"

export const peerReviewVariablesReducer = createReducer<
  { [peerReviewCollectionId: string]: peerReviewCollectionVariables },
  action
>({})
  .handleAction(initializedEditor, (state, action) => {
    return produce(state, (draftState) => {
      for (const peerReviewCollection in action.payload.normalizedQuiz.peerReviewCollections) {
        draftState[peerReviewCollection] = { newQuestions: [] }
      }
    })
  })

  .handleAction(createdNewPeerReviewCollection, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.newId] = { newQuestions: [] }
    })
  })

  .handleAction(createdNewPeerReviewQuestion, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.peerReviewCollectionId].newQuestions.push(action.payload.newId)
    })
  })
