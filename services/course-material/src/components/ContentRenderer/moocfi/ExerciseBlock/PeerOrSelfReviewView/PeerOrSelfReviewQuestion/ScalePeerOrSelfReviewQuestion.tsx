import LikertScale from "../../../../../../shared-module/components/PeerReview/LikertScale"

import { PeerOrSelfReviewQuestionProps } from "."

const ScalePeerOrSelfReviewQuestion: React.FC<
  React.PropsWithChildren<PeerOrSelfReviewQuestionProps>
> = ({ question, setPeerOrSelfReviewQuestionAnswer, peerOrSelfReviewQuestionAnswer }) => {
  return (
    <div>
      <LikertScale
        question={question.question}
        answerRequired={question.answer_required}
        selectedOption={peerOrSelfReviewQuestionAnswer?.number_data ?? null}
        setSelectedOption={(value) =>
          setPeerOrSelfReviewQuestionAnswer({
            text_data: null,
            number_data: value,
          })
        }
      />
    </div>
  )
}

export default ScalePeerOrSelfReviewQuestion
