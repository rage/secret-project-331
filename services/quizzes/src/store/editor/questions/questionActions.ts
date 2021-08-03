import { createAction } from "typesafe-actions"
import { v4 } from "uuid"

export const editedPeerReviewQuestionTitle = createAction(
  "EDITED_PRQ_TITLE",
  (newTitle: string, prqId: string) => ({ newTitle: newTitle, prqId: prqId }),
)<{ newTitle: string; prqId: string }>()

export const editedPeerReviewQuestionBody = createAction(
  "EDITED_PRQ_BODY",
  (newBody: string, prqId: string) => ({ newBody: newBody, prqId: prqId }),
)<{ newBody: string; prqId: string }>()

export const editedPeerReviewQuestionType = createAction(
  "EDITED_PRQ_TYPE",
  (newType: string, prqId: string) => ({ newType: newType, prqId: prqId }),
)<{ newType: string; prqId: string }>()

export const increasedPRQOrder = createAction("INCRESED_PRQ_ORDER", (prqId: string) => ({
  prqId: prqId,
}))<{ prqId: string }>()

export const decreasedPRQOrder = createAction("DECREASED_PRQ_ORDER", (prqId: string) => ({
  prqId: prqId,
}))<{ prqId: string }>()

export const createdNewPeerReviewQuestion = createAction(
  "CREATED_NEW_PRQ",
  (quizId: string, peerReviewCollectionId: string, type: string) => ({
    newId: v4(),
    quizId: quizId,
    peerReviewCollectionId: peerReviewCollectionId,
    type: type,
  }),
)<{
  newId: string
  quizId: string
  peerReviewCollectionId: string
  type: string
}>()

export const toggledQuestionDefault = createAction(
  "TOGGLED_QUESTION_DEFAULT",
  (questionId: string, questionDefault: boolean) => ({
    questionId: questionId,
    questionDefault: questionDefault,
  }),
)<{ questionId: string; questionDefault: boolean }>()

export const toggledQuestionAnswerRequired = createAction(
  "TOGGLED_QUESTION_ANSWER_REQUIRED",
  (questionId: string, answerRequired: boolean) => ({
    questionId: questionId,
    answerRequired: answerRequired,
  }),
)<{ questionId: string; answerRequired: boolean }>()

export const deletedPRQ = createAction(
  "DELETED_PRQ",
  (questionId: string, peerReviewId: string) => ({
    questionId: questionId,
    peerReviewId: peerReviewId,
  }),
)<{ questionId: string; peerReviewId: string }>()

export const prqActions = [
  editedPeerReviewQuestionTitle,
  editedPeerReviewQuestionBody,
  editedPeerReviewQuestionType,
  increasedPRQOrder,
  decreasedPRQOrder,
  createdNewPeerReviewQuestion,
  toggledQuestionDefault,
  toggledQuestionAnswerRequired,
  deletedPRQ,
]

export default prqActions
