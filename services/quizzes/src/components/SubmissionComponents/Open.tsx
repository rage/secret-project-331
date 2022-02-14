import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { ItemAnswerFeedback } from "../../pages/api/grade"
import TextField from "../../shared-module/components/InputFields/TextField"
import { quizTheme } from "../../styles/QuizStyles"
import MarkdownText from "../MarkdownText"

import { QuizItemSubmissionComponentProps } from "."

const correctAnswer = css`
  display: flex;
  align-items: center;
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: ${quizTheme.gradingCorrectItemBackground};
  border-radius: 5px;
`

const incorrectAnswer = css`
  display: flex;
  align-items: center;
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: ${quizTheme.gradingWrongItemBackground};
  border-radius: 5px;
`

const OpenFeedback: React.FC<QuizItemSubmissionComponentProps> = ({
  public_quiz_item,
  quiz_item_feedback,
  user_quiz_item_answer,
}) => {
  const { t } = useTranslation()
  const correct = (quiz_item_feedback as ItemAnswerFeedback).quiz_item_correct
  const item_feedback = (quiz_item_feedback as ItemAnswerFeedback).quiz_item_feedback
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
      `}
    >
      <div>{public_quiz_item.title && <MarkdownText text={public_quiz_item.title} />}</div>
      <div>{public_quiz_item.body && <MarkdownText text={public_quiz_item.body} />}</div>
      <div>
        <TextField
          type="text"
          disabled
          label={t("answer")}
          value={user_quiz_item_answer.textData ?? ""}
        />
      </div>
      <div
        className={css`
          display: flex;
          justify-content: center;
        `}
      >
        <div className={cx(correct ? correctAnswer : incorrectAnswer)}>
          <p>{item_feedback ?? ""}</p>
        </div>
      </div>
    </div>
  )
}

export default OpenFeedback
