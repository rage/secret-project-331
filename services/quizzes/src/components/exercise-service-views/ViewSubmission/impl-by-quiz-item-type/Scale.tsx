import { css } from "@emotion/css"
import React, { useId } from "react"

import { UserItemAnswerScale } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemScale } from "../../../../../types/quizTypes/publicSpec"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import MarkdownText from "../../../MarkdownText"

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
        padding: 0.625rem;
        flex-direction: column;
        margin-bottom: 0.625rem;
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
            margin: 0.5rem 0;
            color: #4c5868;
            font-family: "Raleway", sans-serif;
            font-size: 1.25rem;
            margin-bottom: 1rem;
            font-weight: 500;
          `}
        >
          <MarkdownText text={public_quiz_item.title} />
        </div>
      )}
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          justify-content: space-between;
          list-style: none;
          padding: 0;
        `}
      >
        {Array.from({ length: maxValue - minValue + 1 }, (_, i) => {
          const value = (i + minValue).toString()
          return (
            <div
              key={value}
              className={css`
                display: flex;
                position: relative;
                text-align: center;
                width: 5rem;

                label {
                  cursor: pointer;
                  font-weight: 500;
                  line-height: 1.2;
                  span {
                    color: #4c5868;
                    font-size: 1.125rem;
                    :after {
                      display: inline-block;
                      position: absolute;
                      top: 1px;
                      content: "";
                      background-color: #fff;
                      width: 1.2em;
                      height: 1.2em;
                      border-radius: 50%;
                      margin-left: 0.375em;
                      transition: 0.25s ease;
                      box-shadow: inset 0 0 0 0.15em #dfe1e6;
                    }
                  }

                  input {
                    position: absolute;
                    left: -9999px;
                    &:checked + span {
                      &:after {
                        box-shadow: inset 0 0 0 0.33em #b4bac3;
                        border: 0.188rem solid #dfe1e6;
                      }
                    }
                  }
                }
              `}
            >
              <label>
                <input
                  name={radioIdentifier}
                  aria-label={value}
                  type="radio"
                  key={value}
                  value={value}
                  checked={user_quiz_item_answer?.intData.toString() === value}
                  disabled
                />
                <span>{value}</span>
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default withErrorBoundary(Scale)
