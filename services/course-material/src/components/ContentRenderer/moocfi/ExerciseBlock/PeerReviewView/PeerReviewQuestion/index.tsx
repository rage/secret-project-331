import {
  CourseMaterialPeerReviewQuestionAnswer,
  PeerReviewQuestion as PeerReviewQuestionType,
} from "../../../../../../shared-module/bindings"

import EssayPeerReviewQuestion from "./EssayPeerReviewQuestion"
import ScalePeerReviewQuestion from "./ScalePeerReviewQuestion"

export interface PeerReviewQuestionProps {
  question: PeerReviewQuestionType
  setPeerReviewQuestionAnswer: (
    answer: Omit<CourseMaterialPeerReviewQuestionAnswer, "peer_review_question_id">,
  ) => void
  peerReviewQuestionAnswer: CourseMaterialPeerReviewQuestionAnswer | null
}

const PeerReviewQuestion: React.FC<React.PropsWithChildren<PeerReviewQuestionProps>> = ({
  question,
  setPeerReviewQuestionAnswer,
  peerReviewQuestionAnswer,
}) => {
  if (question.question_type === "Scale") {
    return (
      <ScalePeerReviewQuestion
        question={question}
        setPeerReviewQuestionAnswer={setPeerReviewQuestionAnswer}
        peerReviewQuestionAnswer={peerReviewQuestionAnswer}
      />
    )
  }
  if (question.question_type === "Essay") {
    return (
      <EssayPeerReviewQuestion
        question={question}
        setPeerReviewQuestionAnswer={setPeerReviewQuestionAnswer}
        peerReviewQuestionAnswer={peerReviewQuestionAnswer}
      />
    )
  }
  return null
}

export default PeerReviewQuestion
