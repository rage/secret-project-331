import { createAction } from "typesafe-actions"
import { v4 } from "uuid"

export const editedPeerReviewTitle = createAction(
  "EDITED_PEER_REVIEW_TITLE",
  (peerReviewId: string, newTitle: string) => ({
    peerReviewId: peerReviewId,
    newTitle: newTitle,
  }),
)<{ peerReviewId: string; newTitle: string }>()

export const editedPeerReviewBody = createAction(
  "EDITED_PEER_REVIEW_BODY",
  (peerReviewId: string, newBody: string) => ({
    peerReviewId: peerReviewId,
    newBody: newBody,
  }),
)<{ peerReviewId: string; newBody: string }>()

export const createdNewPeerReview = createAction("CREATED_NEW_PEER_REVIEW", (quizId: string) => ({
  newId: v4(),
  quizId: quizId,
}))<{ newId: string; quizId: string }>()

export const deletePeerReview = createAction("DELETED_PEER_REVIEW", (peerReviewId: string) => ({
  peerReviewId: peerReviewId,
}))<{ peerReviewId: string }>()

const peerReviewActions = [
  editedPeerReviewTitle,
  editedPeerReviewBody,
  createdNewPeerReview,
  deletePeerReview,
]

export default peerReviewActions
