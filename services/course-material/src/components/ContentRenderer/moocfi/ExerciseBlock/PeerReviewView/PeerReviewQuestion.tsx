import {
  CourseMaterialPeerReviewQuestionAnswer,
  PeerReviewQuestion as PeerReviewQuestionType,
} from "../../../../../shared-module/bindings"

import EssayPeerReviewQuestion from "./EssayPeerReviewQuestion"
import ScalePeerReviewQuestion from "./ScalePeerReviewQuestion"

export interface PeerReviewQuestionProps {
  question: PeerReviewQuestionType
  setPeerReviewQuestionAnswer: (
    answer: Omit<CourseMaterialPeerReviewQuestionAnswer, "peer_review_question_id">,
  ) => void
}

const PeerReviewQuestion: React.FC<PeerReviewQuestionProps> = ({
  question,
  setPeerReviewQuestionAnswer,
}) => {
  if (question.question_type === "Scale") {
    return (
      <ScalePeerReviewQuestion
        question={question}
        setPeerReviewQuestionAnswer={setPeerReviewQuestionAnswer}
      />
    )
  }
  if (question.question_type === "Essay") {
    return (
      <EssayPeerReviewQuestion
        question={question}
        setPeerReviewQuestionAnswer={setPeerReviewQuestionAnswer}
      />
    )
  }
  return null
}

export default PeerReviewQuestion
