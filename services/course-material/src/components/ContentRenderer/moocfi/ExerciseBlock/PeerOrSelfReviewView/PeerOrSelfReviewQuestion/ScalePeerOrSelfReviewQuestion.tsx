import { PeerOrSelfReviewQuestionProps } from "."

import LikertScale from "@/shared-module/common/components/PeerReview/LikertScale"

const ScalePeerOrSelfReviewQuestion: React.FC<PeerOrSelfReviewQuestionProps> = ({
  peerOrSelfReviewQuestion,
  setPeerOrSelfReviewQuestionAnswer,
  peerOrSelfReviewQuestionAnswer,
}) => {
  return (
    <div>
      <LikertScale
        question={peerOrSelfReviewQuestion.question}
        answerRequired={peerOrSelfReviewQuestion.answer_required}
        selectedOption={peerOrSelfReviewQuestionAnswer?.number_data ?? null}
        setSelectedOption={(value) =>
          setPeerOrSelfReviewQuestionAnswer({
            text_data: null,
            number_data: value,
          })
        }
        peerOrSelfReviewQuestionId={peerOrSelfReviewQuestion.id}
      />
    </div>
  )
}

export default ScalePeerOrSelfReviewQuestion
