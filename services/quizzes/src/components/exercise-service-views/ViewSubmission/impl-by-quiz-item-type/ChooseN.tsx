import { css } from "@emotion/css"
import React from "react"

import { UserItemAnswerChooseN } from "../../../../../types/quizTypes/answer"
import { ModelSolutionQuizItemChooseN } from "../../../../../types/quizTypes/modelSolutionSpec"
import { PublicSpecQuizItemChooseN } from "../../../../../types/quizTypes/publicSpec"
import { quizTheme } from "../../../../styles/QuizStyles"

import { QuizItemSubmissionComponentProps } from "."

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const MultipleChoiceClickableFeedback: React.FC<
  React.PropsWithChildren<
    QuizItemSubmissionComponentProps<PublicSpecQuizItemChooseN, UserItemAnswerChooseN>
  >
> = ({ user_quiz_item_answer, public_quiz_item, quiz_item_model_solution }) => {
  const modelSolution = quiz_item_model_solution as ModelSolutionQuizItemChooseN
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
          color: #4c5868;
          font-size: 1.25rem;
          margin-bottom: 0.25rem;
          font-weight: 500;
        `}
      >
        {public_quiz_item.title || public_quiz_item.body}
      </h2>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
        `}
      >
        {public_quiz_item.options.map((o) => {
          const optionSelected = user_quiz_item_answer.selectedOptionIds?.includes(o.id)
          const correct = modelSolution?.options.find((mo) => o.id === mo.id)?.correct

          const backgroundColor = correct
            ? quizTheme.gradingCorrectItemBackground
            : quizTheme.gradingWrongItemBackground

          return (
            <button
              key={o.id}
              value={o.id}
              disabled
              className={css`
                align-items: center;
                flex: 1;
                flex-wrap: wrap;
                justify-content: space-between;
                padding: 0.4rem 0.8rem;
                border-radius: 6px;
                font-size: 18px;
                color: #4c5868;

                display: flex;
                margin: 0.5rem 1rem 0.5rem 0;
                flex-grow: 1;
                background-color: ${backgroundColor};
                border: ${optionSelected ? `2px solid #d8d8d8` : "none"};
              `}
            >
              {o.title || o.body}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default withErrorBoundary(MultipleChoiceClickableFeedback)
