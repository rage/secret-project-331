"use client"

import { useTranslation } from "react-i18next"

import TextArea from "@/shared-module/common/components/InputFields/TextAreaField"

import type { PeerOrSelfReviewQuestionProps } from "."

const EssayPeerOrSelfReviewQuestion: React.FC<
  React.PropsWithChildren<PeerOrSelfReviewQuestionProps>
> = ({
  peerOrSelfReviewQuestion,
  setPeerOrSelfReviewQuestionAnswer,
  peerOrSelfReviewQuestionAnswer,
}) => {
  const { t } = useTranslation()
  const label = `${peerOrSelfReviewQuestion.question}${
    peerOrSelfReviewQuestion.answer_required ? " *" : ""
  }`
  return (
    <div>
      <TextArea
        label={label}
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
