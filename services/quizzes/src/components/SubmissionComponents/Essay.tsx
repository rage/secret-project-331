import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../shared-module/styles"
import { wordCount } from "../../shared-module/utils/strings"

import { QuizItemSubmissionComponentProps } from "."

const EssayFeedback: React.FC<QuizItemSubmissionComponentProps> = ({ user_quiz_item_answer }) => {
  const { t } = useTranslation()
  const text = user_quiz_item_answer.textData
  return (
    <div
      className={css`
        display: flex;
        flex: 1;
        flex-wrap: wrap;
        margin: 0.5;
        background: ${baseTheme.colors.grey[300]};
      `}
    >
      <pre
        className={css`
          display: flex;
          white-space: pre-wrap;
          font-family: josefin sans, sans-serif;
        `}
      >
        {`${t("word-count")}: ${wordCount(text)}`}
      </pre>
      <pre
        className={css`
          display: flex;
          font-family: josefin sans, sans-serif;
          white-space: pre-wrap;
        `}
      >
        {text}
      </pre>
    </div>
  )
}

export default EssayFeedback
