import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../shared-module/styles"
import { wordCount } from "../../shared-module/utils/strings"

import { QuizItemSubmissionComponentProps } from "."

const EssayFeedback: React.FC<React.PropsWithChildren<QuizItemSubmissionComponentProps>> = ({
  user_quiz_item_answer,
}) => {
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
          padding: 1rem;
          border-left: 8px solid ${baseTheme.colors.green[300]};
        `}
      >
        <pre
          className={css`
            display: flex;
            font-family: josefin sans, sans-serif;
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
          font-family: josefin sans, sans-serif;
          margin: 1rem 0;
        `}
      >
        <span
          className={css`
            text-transform: uppercase;
            color: ${baseTheme.colors.grey[500]};
          `}
        >
          {t("word-count")}:{" "}
        </span>
        <span>{wordCount(text)}</span>
      </div>
    </div>
  )
}

export default EssayFeedback
