import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import TextArea from "../../../../../../shared-module/components/InputFields/TextAreaField"

import { PeerReviewQuestionProps } from "."

const EssayPeerReviewQuestion: React.FC<React.PropsWithChildren<PeerReviewQuestionProps>> = ({
  question,
  setPeerReviewQuestionAnswer,
  peerReviewQuestionAnswer,
}) => {
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
        onChange={(value) =>
          setPeerReviewQuestionAnswer({
            text_data: value,
            number_data: null,
          })
        }
        value={peerReviewQuestionAnswer?.text_data ?? ""}
      ></TextArea>
    </div>
  )
}

export default EssayPeerReviewQuestion
