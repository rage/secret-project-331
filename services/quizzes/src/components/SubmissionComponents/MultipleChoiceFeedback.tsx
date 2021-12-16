import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../shared-module/styles"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import { quizTheme } from "../../styles/QuizStyles"
import { MarkdownText } from "../MarkdownText"
import { QuizItemSubmissionComponentProps } from "../Submission"

const DIRECTION_COLUMN = "column"
const DIRECTION_ROW = "row"

const correctOptionButton = css`
  align-items: center;
  border: none;
  display: flex;
  flex: 1;
  justify-content: center;
  margin: 0.3rem;
  padding: 1rem;
  background-color: ${baseTheme.colors.green[100]};
`

const inCorrectOptionButton = css`
  align-items: center;
  border: none;
  display: flex;
  flex: 1;
  justify-content: center;
  margin: 0.3rem;
  padding: 1rem;
  background-color: ${baseTheme.colors.red[100]};
`

const optionButtonColumn = css`
  ${respondToOrLarger.xs} {
    justify-content: left;
  }
`
const selectedBorder = css`
  border: 5px solid black;
`

const MultipleChoiceFeedback: React.FC<QuizItemSubmissionComponentProps> = ({
  public_quiz_item,
  quiz_item_feedback,
  quiz_item_model_solution,
  user_quiz_item_answer,
}) => {
  const { t } = useTranslation()
  const direction: "row" | "column" =
    public_quiz_item.direction === DIRECTION_COLUMN ? DIRECTION_COLUMN : DIRECTION_ROW
  return (
    <div
      className={css`
        margin: 0.5rem;
      `}
    >
      <div
        className={css`
          font-size: ${quizTheme.quizTitleFontSize};
          font-weight: bold;
        `}
      >
        {public_quiz_item.title && <MarkdownText text={public_quiz_item.title} />}
      </div>
      <p
        className={css`
          color: ${quizTheme.quizBodyColor};
          font-size: ${quizTheme.quizBodyFontSize};
          margin: 0.5rem 0;
        `}
      >
        {public_quiz_item.body && <MarkdownText text={public_quiz_item.body} />}
      </p>
      <div
        className={css`
          display: flex;
          flex-direction: column;

          ${respondToOrLarger.sm} {
            flex-direction: ${direction};
          }
        `}
      >
        {public_quiz_item.options.map((o) => {
          const model_solution_option = quiz_item_model_solution.options.filter(
            (mso) => mso.id === o.id,
          )[0]
          const correct = model_solution_option.correct
          const selected = user_quiz_item_answer?.optionAnswers?.includes(o.id)
          return (
            <button
              key={o.id}
              aria-label={selected ? t("selected-option") : t("unselected-option")}
              className={cx(
                correct ? correctOptionButton : inCorrectOptionButton,
                direction === DIRECTION_COLUMN ? optionButtonColumn : "",
                selected && selectedBorder,
              )}
            >
              {o.title || o.body}
            </button>
          )
        })}
      </div>
      <div
        className={css`
          display: flex;
          flex-direction: column;

          ${respondToOrLarger.sm} {
            flex-direction: ${direction};
          }
        `}
      >
        {quiz_item_feedback.quiz_item_option_feedbacks &&
          quiz_item_feedback.quiz_item_option_feedbacks.map((of) => {
            if (of.option_feedback) {
              return (
                <p
                  className={css`
                    color: ${quizTheme.quizBodyColor};
                    font-size: ${quizTheme.quizBodyFontSize};
                    margin: 0.5rem 0;
                  `}
                >
                  {of.option_feedback}
                </p>
              )
            }
          })}
      </div>
    </div>
  )
}

export default MultipleChoiceFeedback
