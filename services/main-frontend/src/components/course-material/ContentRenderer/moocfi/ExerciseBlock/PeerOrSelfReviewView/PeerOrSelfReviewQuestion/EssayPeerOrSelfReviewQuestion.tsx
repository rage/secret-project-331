"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { PeerOrSelfReviewQuestionProps } from "."

import TextArea from "@/shared-module/common/components/InputFields/TextAreaField"

const EssayPeerOrSelfReviewQuestion: React.FC<
  React.PropsWithChildren<PeerOrSelfReviewQuestionProps>
> = ({
  peerOrSelfReviewQuestion,
  setPeerOrSelfReviewQuestionAnswer,
  peerOrSelfReviewQuestionAnswer,
}) => {
  const { t } = useTranslation()
  return (
    <div>
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        {peerOrSelfReviewQuestion.question}
        {peerOrSelfReviewQuestion.answer_required && " *"}
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
