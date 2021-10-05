import { css } from "@emotion/css"

import { respondToOrLarger } from "../../shared-module/styles/respond"
import { QuizItemAnswer } from "../../types/types"

import { QuizItemComponentProps } from "."

export const MultipleChoiceDropdown: React.FunctionComponent<QuizItemComponentProps> = ({
  quizItem,
  quizItemAnswerState,
  setQuizItemAnswerState,
}) => {
  const handleOptionSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!quizItemAnswerState) {
      return
    }

    const selectedOptionId = event.currentTarget.value

    const newItemAnswer: QuizItemAnswer = {
      ...quizItemAnswerState,
      optionAnswers: [selectedOptionId],
    }
    setQuizItemAnswerState(newItemAnswer)
  }
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        ${respondToOrLarger.sm} {
          flex-direction: row;
        }
      `}
    >
      <div
        className={css`
          display: flex;
          flex-direction: column;
          width: 70%;
        `}
      >
        <div
          className={css`
            display: flex;
            margin: 0.5rem;
          `}
        >
          <h2>{quizItem.title}</h2>
        </div>
        <div
          className={css`
            display: flex;
            margin: 0.5rem;
          `}
        >
          <h4>{quizItem.body}</h4>
        </div>
      </div>
      <div
        className={css`
          display: flex;
          width: 30%;
          align-items: center;
          margin: 0.5rem;
        `}
      >
        <select
          onBlur={(e) => console.log(e)}
          onChange={handleOptionSelect}
          className={css`
            display: flex;
            width: 100%;
          `}
        >
          <option
            disabled
            selected
            value=""
            className={css`
              display: flex;
            `}
          >
            Answer
          </option>
          {quizItem.options.map((o) => (
            <option
              key={o.id}
              value={o.id}
              className={css`
                display: flex;
              `}
            >
              {o.title || o.body}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
