import { css } from "@emotion/css"
import React, { useId } from "react"

import { UserItemAnswerScale } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemScale } from "../../../../../types/quizTypes/publicSpec"
import { respondToOrLarger } from "../../../../shared-module/common/styles/respond"
import withErrorBoundary from "../../../../shared-module/common/utils/withErrorBoundary"
import MarkdownText from "../../../MarkdownText"

import { QUIZ_TITLE_STYLE } from "./AnswerQuizStyles"

import { QuizItemComponentProps } from "."

const Scale: React.FC<QuizItemComponentProps<PublicSpecQuizItemScale, UserItemAnswerScale>> = ({
  quizItem,
  quizItemAnswerState,
  setQuizItemAnswerState,
}) => {
  const minValue = quizItem.minValue ?? 1
  const maxValue = quizItem.maxValue ?? 7
  const radioIdentifier = useId()
  const radioLabelId = useId()

  const handleOptionSelect = (selectedOption: string) => {
    if (!quizItemAnswerState) {
      setQuizItemAnswerState({
        quizItemId: quizItem.id,
        intData: Number(selectedOption),
        valid: true,
        type: "scale",
      })
      return
    }

    setQuizItemAnswerState({ ...quizItemAnswerState, intData: Number(selectedOption), valid: true })
  }

  return (
    <div
      role="group"
      aria-labelledby={radioLabelId}
      className={css`
        display: flex;
        flex: 1;
        min-width: 100%;
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
      {quizItem.title && (
        <div
          id={radioLabelId}
          className={css`
            ${QUIZ_TITLE_STYLE}
            ${respondToOrLarger.md} {
              text-align: left;
            }
          `}
        >
          <ParsedText inline parseLatex parseMarkdown text={quizItem.title} />
        </div>
      )}
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
          row-gap: 1rem;
          column-gap: 0;
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
                        box-shadow: inset 0 0 0 0.33em #627ba7;
                        border: 0.188rem solid #718dbf;
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
                  checked={
                    quizItemAnswerState !== null && quizItemAnswerState.intData === Number(value)
                  }
                  onClick={(e) => handleOptionSelect(e.currentTarget.value)}
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
