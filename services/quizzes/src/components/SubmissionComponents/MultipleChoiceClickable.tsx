import { css } from "@emotion/css"
import React from "react"

import { respondToOrLarger } from "../../shared-module/styles/respond"
import { quizTheme } from "../../styles/QuizStyles"

import { QuizItemSubmissionComponentProps } from "."

const MultipleChoiceClickableFeedback: React.FC<QuizItemSubmissionComponentProps> = ({
  user_quiz_item_answer,
  public_quiz_item,
  quiz_item_model_solution,
}) => {
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        ${respondToOrLarger.md} {
          flex-direction: row;
        }
      `}
    >
      <h2
        className={css`
          display: flex;
        `}
      >
        {public_quiz_item.title || public_quiz_item.body}
      </h2>

      {public_quiz_item.options.map((o) => {
        const optionSelected = user_quiz_item_answer.optionAnswers?.includes(o.id)
        const correct = quiz_item_model_solution?.options.find((mo) => o.id === mo.id)?.correct

        const correctItemBackgroundColor = quizTheme.gradingCorrectItemBackground
        const wrongItemBackgroundColor = quizTheme.gradingWrongItemBackground
        const correctItemForegroundColor = quizTheme.gradingCorrectItemColor
        const wrongItemForegroundColor = quizTheme.gradingWrongItemColor

        return (
          <button
            key={o.id}
            value={o.id}
            disabled
            className={css`
              display: flex;
              margin: 0.5rem;
              flex-grow: 1;
              color: ${correct ? correctItemForegroundColor : wrongItemForegroundColor};
              background-color: ${correct ? correctItemBackgroundColor : wrongItemBackgroundColor};
              ${optionSelected && "border: 2px solid black;"}
            `}
          >
            {o.title || o.body}
          </button>
        )
      })}
    </div>
  )
}

export default MultipleChoiceClickableFeedback
