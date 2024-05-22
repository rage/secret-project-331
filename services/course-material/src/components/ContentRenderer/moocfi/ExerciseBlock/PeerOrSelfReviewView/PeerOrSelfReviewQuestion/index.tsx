import EssayPeerOrSelfReviewQuestion from "./EssayPeerOrSelfReviewQuestion"
import ScalePeerOrSelfReviewQuestion from "./ScalePeerOrSelfReviewQuestion"

import {
  CourseMaterialPeerOrSelfReviewQuestionAnswer,
  PeerOrSelfReviewQuestion as PeerOrSelfReviewQuestionType,
} from "@/shared-module/common/bindings"

export interface PeerOrSelfReviewQuestionProps {
  question: PeerOrSelfReviewQuestionType
  setPeerOrSelfReviewQuestionAnswer: (
    answer: Omit<CourseMaterialPeerOrSelfReviewQuestionAnswer, "peer_or_self_review_question_id">,
  ) => void
  peerOrSelfReviewQuestionAnswer: CourseMaterialPeerOrSelfReviewQuestionAnswer | null
}

const PeerOrSelfReviewQuestion: React.FC<
  React.PropsWithChildren<PeerOrSelfReviewQuestionProps>
> = ({ question, setPeerOrSelfReviewQuestionAnswer, peerOrSelfReviewQuestionAnswer }) => {
  if (question.question_type === "Scale") {
    return (
      <ScalePeerOrSelfReviewQuestion
        question={question}
        setPeerOrSelfReviewQuestionAnswer={setPeerOrSelfReviewQuestionAnswer}
        peerOrSelfReviewQuestionAnswer={peerOrSelfReviewQuestionAnswer}
      />
    )
  }
  if (question.question_type === "Essay") {
    return (
      <EssayPeerOrSelfReviewQuestion
        question={question}
        setPeerOrSelfReviewQuestionAnswer={setPeerOrSelfReviewQuestionAnswer}
        peerOrSelfReviewQuestionAnswer={peerOrSelfReviewQuestionAnswer}
      />
    )
  }
  return null
}

export default PeerOrSelfReviewQuestion
