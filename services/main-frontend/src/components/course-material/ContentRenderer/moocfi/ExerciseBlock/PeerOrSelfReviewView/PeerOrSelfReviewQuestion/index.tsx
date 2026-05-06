"use client"

import EssayPeerOrSelfReviewQuestion from "./EssayPeerOrSelfReviewQuestion"
import ScalePeerOrSelfReviewQuestion from "./ScalePeerOrSelfReviewQuestion"

import type {
  CourseMaterialPeerOrSelfReviewQuestionAnswer,
  PeerOrSelfReviewQuestion,
} from "@/generated/course-material-api/types.generated"

export interface PeerOrSelfReviewQuestionProps {
  peerOrSelfReviewQuestion: PeerOrSelfReviewQuestion
  setPeerOrSelfReviewQuestionAnswer: (
    answer: Omit<CourseMaterialPeerOrSelfReviewQuestionAnswer, "peer_or_self_review_question_id">,
  ) => void
  peerOrSelfReviewQuestionAnswer: CourseMaterialPeerOrSelfReviewQuestionAnswer | null
}

const PeerOrSelfReviewQuestionComponent: React.FC<
  React.PropsWithChildren<PeerOrSelfReviewQuestionProps>
> = (props) => {
  if (props.peerOrSelfReviewQuestion.question_type === "Scale") {
    return <ScalePeerOrSelfReviewQuestion {...props} />
  }
  if (props.peerOrSelfReviewQuestion.question_type === "Essay") {
    return <EssayPeerOrSelfReviewQuestion {...props} />
  }
  return null
}

export default PeerOrSelfReviewQuestionComponent
