import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { QuizItemAnswer } from "../../../types/types"
import TextArea from "../../shared-module/components/InputFields/TextAreaField"
import { wordCount } from "../../shared-module/utils/strings"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

import { QuizItemComponentProps } from "."

const Essay: React.FunctionComponent<QuizItemComponentProps> = ({
  quizItemAnswerState,
  quizItem,
  setQuizItemAnswerState,
}) => {
  const { t } = useTranslation()
  const text = quizItemAnswerState?.textData ?? ""
  const usersWordCount = useMemo(() => wordCount(text), [text])
  return (
    <div
      className={css`
        display: flex;
        flex: 1;
        flex-direction: column;
      `}
    >
      <div
        className={css`
          display: flex;
          margin: 0.5rem 0;
          font-size: 20px;
        `}
      >
        {quizItem.title}
      </div>
      <div
        className={css`
          display: flex;
          margin: 0.5rem 0;
          font-size: 20px;
        `}
      >
        {quizItem.body}
      </div>
      <div
        className={css`
          display: flex;
          margin: 0.5rem 0;
          text-transform: uppercase;
          color: #757575;
          strong {
            color: #333333;
            margin: 0 5px;
          }
        `}
      >
        {t("min-words")}: <strong>{quizItem.minWords}</strong> | {t("max-words")}:{" "}
        <strong>{quizItem.maxWords}</strong>
      </div>

      <div
        className={css`
          display: flex;
          margin: 0.5rem 0;
        `}
      >
        <TextArea
          onChangeByValue={(newValue) => {
            if (quizItemAnswerState) {
              let valid = true
              if (quizItem.minWords && quizItem.minWords > wordCount(newValue)) {
                valid = false
              }
              if (quizItem.maxWords && quizItem.maxWords < wordCount(newValue)) {
                valid = false
              }
              const newQuizItemAnswerState: QuizItemAnswer = {
                ...quizItemAnswerState,
                textData: newValue,
                valid: valid,
              }
              setQuizItemAnswerState(newQuizItemAnswerState)
            }
          }}
          placeholder={t("answer")}
          aria-label={t("answer")}
          rows={10}
          autoResize
          className={css`
            width: 100%;
            textarea {
              width: 100%;
              height: 200px;
              resize: vertical;
            }
          `}
          value={text}
        />
      </div>
      <div
        className={css`
          display: flex;
          margin: 0.5rem 0;
          text-transform: uppercase;
          color: #757575;
          strong {
            color: #333333;
            margin: 0 5px;
          }
        `}
      >
        {t("word-count")}: <strong>{usersWordCount}</strong>
      </div>
    </div>
  )
}

export default withErrorBoundary(Essay)
