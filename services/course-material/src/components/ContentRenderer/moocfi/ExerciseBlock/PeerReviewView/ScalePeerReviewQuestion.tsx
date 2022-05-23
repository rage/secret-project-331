import LinkertScale from "../../../../../shared-module/components/PeerReview/LinkertScale"

import { PeerReviewQuestionProps } from "./PeerReviewQuestion"

const ScalePeerReviewQuestion: React.FC<PeerReviewQuestionProps> = ({ question }) => {
  return (
    <div>
      <LinkertScale question={question.question} answerRequired={question.answer_required} />
    </div>
  )
}

export default ScalePeerReviewQuestion
