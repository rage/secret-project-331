import { css, cx } from "@emotion/css"
import React from "react"

import { EssayItemAnswerFeedback } from "../../pages/api/grade"
import { quizTheme } from "../../styles/QuizStyles"
import { QuizItemSubmissionComponentProps } from "../Submission"

// eslint-disable-next-line i18next/no-literal-string
const SubmissionMessageStyles = css`
  display: flex;
  flex: 1;
  font-size: ${quizTheme.quizBodyFontSize};
`

const DEFAULT_SUBMIT_MESSAGE = "your answer has been submited"

const EssayFeedback: React.FC<QuizItemSubmissionComponentProps> = ({ quiz_item_feedback }) => {
  return (
    quiz_item_feedback && (
      <div
        className={css`
          display: flex;
          flex: 1;
          margin: 0.5;
        `}
      >
        <div className={cx(SubmissionMessageStyles)}>
          {(quiz_item_feedback as EssayItemAnswerFeedback).submit_message
            ? (quiz_item_feedback as EssayItemAnswerFeedback).submit_message
            : DEFAULT_SUBMIT_MESSAGE}
        </div>
      </div>
    )
  )
}

export default EssayFeedback
