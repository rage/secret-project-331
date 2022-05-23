import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import TextArea from "../../../../../shared-module/components/InputFields/TextAreaField"

import { PeerReviewQuestionProps } from "./PeerReviewQuestion"

const EssayPeerReviewQuestion: React.FC<PeerReviewQuestionProps> = ({ question }) => {
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
        onChange={() => null}
      ></TextArea>
    </div>
  )
}

export default EssayPeerReviewQuestion
