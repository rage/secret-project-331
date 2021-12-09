import { css } from "@emotion/css"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { QuizItemAnswer } from "../../../types/types"
import { wordCount } from "../../shared-module/utils/strings"

import { QuizItemComponentProps } from "."

const Essay: React.FunctionComponent<QuizItemComponentProps> = ({
  quizItemAnswerState,
  quizItem,
  setQuizItemAnswerState,
}) => {
  const { t } = useTranslation()
  const [usersWordCount, setUsersWordCOunt] = useState<number>(0)

  useEffect(() => {
    if (quizItemAnswerState) {
      setUsersWordCOunt(wordCount(quizItemAnswerState.textData))
    }
  }, [quizItemAnswerState])

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (quizItemAnswerState) {
      const newQuizItemAnswerState: QuizItemAnswer = {
        ...quizItemAnswerState,
        textData: event.target.value,
        valid: quizItem.minWords ? usersWordCount > quizItem.minWords : false,
      }
      setQuizItemAnswerState(newQuizItemAnswerState)
    }
  }

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
      `}
    >
      <div
        className={css`
          display: flex;
          margin: 0.5rem;
        `}
      >
        {quizItem.title}
      </div>
      <div
        className={css`
          display: flex;
          margin: 0.5rem;
        `}
      >
        {quizItem.body}
      </div>
      <div
        className={css`
          display: flex;
          margin: 0.5rem;
        `}
      >
        {t("min-words")}: {quizItem.minWords} | {t("max-words")}: {quizItem.maxWords}
      </div>
      <div
        className={css`
          display: flex;
          margin: 0.5rem;
        `}
      >
        {t("word-count")}: {usersWordCount}
      </div>
      <div
        className={css`
          display: flex;
          margin: 0.5rem;
        `}
      >
        <textarea
          onChange={handleTextChange}
          placeholder={t("answer")}
          className={css`
            width: 100%;
            height: 200px;
            resize: both;
          `}
        >
          {quizItemAnswerState?.textData}
        </textarea>
      </div>
    </div>
  )
}

export default Essay
