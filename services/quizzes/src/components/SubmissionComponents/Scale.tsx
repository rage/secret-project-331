import { css } from "@emotion/css"
import React, { useId } from "react"

import { UserItemAnswerScale } from "../../../types/quizTypes/answer"
import { PublicSpecQuizItemScale } from "../../../types/quizTypes/publicSpec"
import { primaryFont } from "../../shared-module/styles"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import MarkdownText from "../MarkdownText"

import { QuizItemSubmissionComponentProps } from "."

const Scale: React.FC<
  QuizItemSubmissionComponentProps<PublicSpecQuizItemScale, UserItemAnswerScale>
> = ({ public_quiz_item, user_quiz_item_answer }) => {
  const minValue = public_quiz_item.minValue ?? 1
  const maxValue = public_quiz_item.maxValue ?? 7
  const radioIdentifier = useId()
  const radioLabelId = useId()

  return (
    <div
      role="group"
      aria-labelledby={radioLabelId}
      className={css`
        display: flex;
        padding: 10px;
        flex-direction: column;
        margin-bottom: 10px;
        background: white;
        ${respondToOrLarger.md} {
          flex-direction: row;
          flex-wrap: wrap;
        }
      `}
    >
      {public_quiz_item.title && (
        <div
          id={radioLabelId}
          className={css`
            flex: 5;
            margin: 0.5rem;
            text-align: center;
            font-family: ${primaryFont};
            font-size: 18px;
            ${respondToOrLarger.md} {
              text-align: left;
            }
          `}
        >
          <MarkdownText text={public_quiz_item.title} />
        </div>
      )}
      <div
        className={css`
          flex: 7;
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
        `}
      >
        {Array.from({ length: maxValue - minValue + 1 }, (_, i) => {
          const value = (i + minValue).toString()
          return (
            <div
              key={value}
              className={css`
                flex: 1 3rem;
                margin: 0.5rem;
              `}
            >
              <label>
                {value}
                <input
                  name={radioIdentifier}
                  aria-label={value}
                  type="radio"
                  key={value}
                  value={value}
                  // checked={user_quiz_item_answer?.optionAnswers?.includes(value)}
                  disabled
                />
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default withErrorBoundary(Scale)
