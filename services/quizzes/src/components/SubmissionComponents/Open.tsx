import { css, cx } from "@emotion/css"
import React from "react"

import { ItemAnswerFeedback } from "../../pages/api/grade"
import { quizTheme } from "../../styles/QuizStyles"
import { MarkdownText } from "../MarkdownText"

import { QuizItemSubmissionComponentProps } from "."

const correctAnswer = css`
  display: flex;
  flex: 1;
  background: ${quizTheme.gradingCorrectItemBackground};
`

const incorrectAnswer = css`
  display: flex;
  flex: 1;
  background: ${quizTheme.gradingWrongItemBackground};
`

const OpenFeedback: React.FC<QuizItemSubmissionComponentProps> = ({
  public_quiz_item,
  quiz_item_feedback,
  user_quiz_item_answer,
}) => {
  const correct = user_quiz_item_answer.correct
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
        <p className={cx(correct ? correctAnswer : incorrectAnswer)}>
          {user_quiz_item_answer.textData ?? ""}
        </p>
        <p>{item_feedback ?? ""}</p>
      </div>
    </div>
  )
}

export default OpenFeedback
