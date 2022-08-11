import { css } from "@emotion/css"
import React from "react"

import { primaryFont } from "../../shared-module/styles"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import MarkdownText from "../MarkdownText"

import { QuizItemComponentProps } from "."

const Scale: React.FC<QuizItemComponentProps> = ({
  quizItem,
  quizItemAnswerState,
  setQuizItemAnswerState,
}) => {
  const minValue = quizItem.minValue ?? 1
  const maxValue = quizItem.maxValue ?? 7

  const handleOptionSelect = (option: string) => {
    if (!quizItemAnswerState) {
      return
    }

    setQuizItemAnswerState({ ...quizItemAnswerState, optionAnswers: [option], valid: true })
  }

  return (
    <div
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
      <div
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
        {quizItem.title && <MarkdownText text={quizItem.title} />}
      </div>
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
              <label htmlFor={value}>{value}</label>
              <input
                aria-label={value}
                type="radio"
                key={value}
                value={value}
                checked={quizItemAnswerState?.optionAnswers?.includes(value)}
                onClick={(e) => handleOptionSelect(e.currentTarget.value)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default withErrorBoundary(Scale)
