import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { QuizItemAnswer } from "../../../types/types"
import { respondToOrLarger } from "../../shared-module/styles/respond"

import { QuizItemComponentProps } from "."

export const MultipleChoiceDropdown: React.FunctionComponent<QuizItemComponentProps> = ({
  quizItem,
  quizItemAnswerState,
  setQuizItemAnswerState,
}) => {
  const { t } = useTranslation()
  const handleOptionSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!quizItemAnswerState) {
      return
    }

    const selectedOptionId = event.currentTarget.value

    const newItemAnswer: QuizItemAnswer = {
      ...quizItemAnswerState,
      optionAnswers: [selectedOptionId],
      valid: true,
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
            margin: 0.5rem 0;
          `}
        >
          {quizItem.title ? (
            <>
              <h2
                className={css`
                  font-family: "Lato", sans-serif;
                  font-weight: 400;
                  font-size: clamp(18px, 2vw, 20px) !important;
                `}
              >
                {quizItem.title}
              </h2>
            </>
          ) : null}
        </div>
        <div
          className={css`
            display: flex;
            margin: 0.5rem;
          `}
        >
          {quizItem.body ? (
            <>
              <h3
                className={css`
                  font-size: clamp(18px, 2vw, 20px) !important;
                `}
              >
                {quizItem.body}
              </h3>
            </>
          ) : null}
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
          onChange={handleOptionSelect}
          aria-label={t("answer")}
          className={css`
            display: grid;
            width: 100%;
            border: 1px solid #e0e0e0;
            border-radius: 3px;
            padding: 10px 12px;
            font-size: 18px;
            cursor: pointer;
            background: #f9f9f9;
            grid-template-areas: "select";
            align-items: center;
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
            {t("answer")}
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
