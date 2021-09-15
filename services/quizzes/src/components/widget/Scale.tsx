import { css } from "@emotion/css"
import React from "react"

import { MarkdownText } from "../MarkdownText"

import { QuizItemComponentProps } from "."

const Scale: React.FC<QuizItemComponentProps> = ({
  quizItem,
  quizItemAnswerState,
  setQuizItemAnswerState,
}) => {
  const minValue = quizItem.minValue ?? 1
  const maxValue = quizItem.maxValue ?? 5

  const handleOptionSelect = (option: string) => {
    if (!quizItemAnswerState) {
      return
    }

    setQuizItemAnswerState({ ...quizItemAnswerState, optionAnswers: [option] })
  }

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        /* respondToOrLarger.sm */
        @media (min-width: 36rem) {
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
          /* respondToOrLarger.sm */
          @media (min-width: 36rem) {
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
              className={css`
                flex: 1 3rem;
                margin: 0.5rem;
              `}
            >
              <label htmlFor={value}>{value}</label>
              <input
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

export default Scale
