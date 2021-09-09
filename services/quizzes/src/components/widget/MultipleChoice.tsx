import { css } from "@emotion/css"
import _ from "lodash"
import React from "react"

import { QuizItemAnswer, QuizItemOptionAnswer } from "../../types/types"
import { MarkdownText } from "../MarkdownText"

import { QuizItemComponentProps } from "."

export interface LeftBorderedDivProps {
  correct: boolean | undefined
  direction?: string
  message?: string
}

const MultipleChoice: React.FunctionComponent<QuizItemComponentProps> = ({
  quizItemAnswerState,
  quizItem,
  setQuizItemAnswerState,
}) => {
  const direction = quizItem.direction || "row"

  // 2 directions
  // render title and body
  // render options

  // direction row = everything in one row

  const handleOptionSelect = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (quizItemAnswerState) {
      const selectedOption = JSON.parse(event.currentTarget.value) as QuizItemOptionAnswer
      let newItemAnswer: QuizItemAnswer
      if (quizItem.multi) {
        newItemAnswer = {
          ...quizItemAnswerState,
          optionAnswers: _.xorBy(quizItemAnswerState.optionAnswers, [selectedOption], "id"),
        }
      } else {
        newItemAnswer = {
          ...quizItemAnswerState,
          optionAnswers: [selectedOption],
        }
      }
      setQuizItemAnswerState(newItemAnswer)
    }
  }

  if (direction === "row") {
    return (
      <div
        className={css`
          display: flex;
          flex-direction: column;
        `}
      >
        <div
          className={css`
            display: flex;
            margin: 0.5rem;
          `}
        >
          {quizItem.title && <MarkdownText text={quizItem.title} />}
        </div>
        <div
          className={css`
            display: flex;
            margin: 0.5rem;
          `}
        >
          {quizItem.body && <MarkdownText text={quizItem.body} />}
        </div>
        <div
          className={css`
            display: flex;
            flex: 1;
            flex-direction: row;
            justify-content: space-between;
          `}
        >
          {quizItem.options.map((qo) => {
            return (
              <button
                key={qo.id}
                value={JSON.stringify(qo)}
                onClick={handleOptionSelect}
                className={css`
                  display: flex;
                  margin: 0.5rem;
                  flex: 1;
                  justify-content: center;
                  ${quizItemAnswerState?.optionAnswers.map((qioa) => qioa.id).includes(qo.id) &&
                  "border: 2px solid #4caf50; /* Green */"}
                `}
              >
                {qo.title || qo.body}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // direction column = everything stacked

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
      `}
    >
      <div
        className={css`
          display: flex;
          margin: 0.5rem;
        `}
      >
        {quizItem.title && <MarkdownText text={quizItem.title} />}
      </div>
      <div
        className={css`
          display: flex;
          margin: 0.5rem;
        `}
      >
        {quizItem.body && <MarkdownText text={quizItem.body} />}
      </div>
      <div
        className={css`
          display: flex;
          flex-direction: column;
        `}
      >
        {quizItem.options.map((qo) => {
          return (
            <button
              key={qo.id}
              value={JSON.stringify(qo)}
              onClick={handleOptionSelect}
              className={css`
                display: flex;
                margin: 0.5rem;
                flex: 1;
                justify-content: center;
                ${quizItemAnswerState?.optionAnswers.map((qioa) => qioa.id).includes(qo.id) &&
                "border: 2px solid #4caf50; /* Green */"}
              `}
            >
              {qo.title || qo.body}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MultipleChoice
