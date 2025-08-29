import { css } from "@emotion/css"

import { PeerOrSelfReviewQuestionProps } from "."

import TextArea from "@/shared-module/common/components/InputFields/TextAreaField"

const EssayPeerOrSelfReviewQuestion: React.FC<
  React.PropsWithChildren<PeerOrSelfReviewQuestionProps>
> = ({
  peerOrSelfReviewQuestion,
  setPeerOrSelfReviewQuestionAnswer,
  peerOrSelfReviewQuestionAnswer,
}) => {
  return (
    <div>
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <label htmlFor={"essay-" + peerOrSelfReviewQuestion.id}>
          {peerOrSelfReviewQuestion.question} {peerOrSelfReviewQuestion.answer_required && " *"}
        </label>
      </div>
      <TextArea
        id={"essay-" + peerOrSelfReviewQuestion.id}
        rows={4}
        autoResize
        onChangeByValue={(value) =>
          setPeerOrSelfReviewQuestionAnswer({
            text_data: value,
            number_data: null,
          })
        }
        value={peerOrSelfReviewQuestionAnswer?.text_data ?? ""}
      ></TextArea>
    </div>
  )
}

export default EssayPeerOrSelfReviewQuestion
