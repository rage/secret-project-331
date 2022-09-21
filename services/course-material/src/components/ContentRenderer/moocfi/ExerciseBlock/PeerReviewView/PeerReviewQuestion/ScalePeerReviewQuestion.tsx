import LikertScale from "../../../../../../shared-module/components/PeerReview/LikertScale"

import { PeerReviewQuestionProps } from "."

const ScalePeerReviewQuestion: React.FC<React.PropsWithChildren<PeerReviewQuestionProps>> = ({
  question,
  setPeerReviewQuestionAnswer,
  peerReviewQuestionAnswer,
}) => {
  return (
    <div>
      <LikertScale
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
