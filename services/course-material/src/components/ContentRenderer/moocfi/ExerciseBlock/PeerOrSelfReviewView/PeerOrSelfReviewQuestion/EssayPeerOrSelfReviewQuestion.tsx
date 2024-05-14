import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import TextArea from "../../../../../../shared-module/components/InputFields/TextAreaField"

import { PeerOrSelfReviewQuestionProps } from "."

const EssayPeerOrSelfReviewQuestion: React.FC<
  React.PropsWithChildren<PeerOrSelfReviewQuestionProps>
> = ({ question, setPeerOrSelfReviewQuestionAnswer, peerOrSelfReviewQuestionAnswer }) => {
  const { t } = useTranslation()
  return (
    <div>
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        {question.question}
        {question.answer_required && " *"}
      </div>
      <TextArea
        rows={4}
        autoResize
        placeholder={t("write-a-review")}
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
