import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerEssay } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemEssay } from "../../../../../types/quizTypes/publicSpec"

import { QuizItemSubmissionComponentProps } from "."

import { wordCount } from "@/shared-module/common/utils/strings"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const EssayFeedback: React.FC<
  QuizItemSubmissionComponentProps<PublicSpecQuizItemEssay, UserItemAnswerEssay>
> = ({ user_quiz_item_answer }) => {
  const { t } = useTranslation()
  const text = user_quiz_item_answer.textData
  return (
    <div>
      <div
        className={css`
          display: flex;
          flex: 1;
          flex-wrap: wrap;
          margin: 0.5;
          background: white;
          flex-direction: column;
        `}
      >
        <pre
          className={css`
            display: flex;
            font-family: Raleway, sans-serif;
            color: #676e7b;
            font-size: 1.125rem;
            font-weight: 500;
            white-space: pre-wrap;
          `}
        >
          {text?.trim()}
        </pre>
      </div>
      <div
        className={css`
          display: flex;
          white-space: pre-wrap;
          font-family: Raleway, sans-serif;
          font-weight: 600;
          font-size: 1.125rem;
          color: #4c5868;
          margin: 1rem 0;
        `}
      >
        <span>{t("word-count")}: </span>
        <span>{wordCount(text)}</span>
      </div>
    </div>
  )
}

export default withErrorBoundary(EssayFeedback)
