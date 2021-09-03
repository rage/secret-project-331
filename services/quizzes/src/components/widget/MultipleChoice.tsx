import { css } from "@emotion/css"
import styled from "styled-components"

import { MarkdownText } from "../MarkdownText"

import { QuizItemComponentProps } from "."

export interface LeftBorderedDivProps {
  correct: boolean | undefined
  direction?: string
  message?: string
}

const LeftAlignedMarkdownText = styled(MarkdownText)`
  text-align: left;
`

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

  if (direction === "row") {
    return (
      <div
        className={css`
          display: flex;
          flex-direction: row;
        `}
      >
        <div>
          {quizItem.title && <LeftAlignedMarkdownText text={quizItem.title} />}
          {quizItem.body && <MarkdownText text={quizItem.body} />}
        </div>
        <div
          className={css`
            flex: 1;
            display: flex;
            flex-direction: row;
          `}
        >
          {quizItem.options.map((qo) => {
            return <button key={qo.id}>{qo.title}</button>
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
      {quizItem.title && <LeftAlignedMarkdownText text={quizItem.title} />}
      {quizItem.body && <MarkdownText text={quizItem.body} />}

      {quizItem.options.map((qo) => {
        return <button key={qo.id}>{qo.title}</button>
      })}
    </div>
  )
}

export default MultipleChoice
