import { css } from "@emotion/css"
import React, { useId } from "react"

import { UserItemAnswerScale } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemScale } from "../../../../../types/quizTypes/publicSpec"
import { primaryFont } from "../../../../shared-module/common/styles"
import { respondToOrLarger } from "../../../../shared-module/common/styles/respond"
import withErrorBoundary from "../../../../shared-module/common/utils/withErrorBoundary"
import MarkdownText from "../../../MarkdownText"

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
      {quizItem.title && (
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
          <MarkdownText text={quizItem.title} />
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
                  checked={
                    quizItemAnswerState !== null && quizItemAnswerState.intData === Number(value)
                  }
                  onClick={(e) => handleOptionSelect(e.currentTarget.value)}
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
