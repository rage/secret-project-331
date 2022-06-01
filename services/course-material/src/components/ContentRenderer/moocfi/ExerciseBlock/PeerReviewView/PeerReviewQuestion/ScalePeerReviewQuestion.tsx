import LinkertScale from "../../../../../../shared-module/components/PeerReview/LinkertScale"

import { PeerReviewQuestionProps } from "."

const ScalePeerReviewQuestion: React.FC<PeerReviewQuestionProps> = ({
  question,
  setPeerReviewQuestionAnswer,
  peerReviewQuestionAnswer,
}) => {
  return (
    <div>
      <LinkertScale
        question={question.question}
        answerRequired={question.answer_required}
        selectedOption={peerReviewQuestionAnswer?.number_data ?? null}
        setSelectedOption={(value) =>
          setPeerReviewQuestionAnswer({
            text_data: null,
            number_data: value,
          })
        }
      />
    </div>
  )
}

export default ScalePeerReviewQuestion
