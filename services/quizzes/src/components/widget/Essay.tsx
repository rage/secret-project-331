import { css } from "@emotion/css"
import { TextField } from "@material-ui/core"
import React from "react"

import { QuizItemAnswer } from "../../types/types"

import { QuizItemComponentProps } from "."

const Essay: React.FunctionComponent<QuizItemComponentProps> = ({
  quizItemAnswerState,
  quizItem,
  setQuizItemAnswerState,
}) => {
  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (quizItemAnswerState) {
      const newQuizItemAnswerState: QuizItemAnswer = {
        ...quizItemAnswerState,
        textData: event.target.value,
      }
      setQuizItemAnswerState(newQuizItemAnswerState)
    }
  }

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
        {quizItem.title}
      </div>
      <div
        className={css`
          display: flex;
          margin: 0.5rem;
        `}
      >
        {quizItem.body}
      </div>
      <div
        className={css`
          display: flex;
          margin: 0.5rem;
        `}
      >
        <TextField onChange={handleTextChange} multiline fullWidth placeholder="Answer">
          {quizItemAnswerState?.textData}
        </TextField>
      </div>
    </div>
  )
}

export default Essay
