import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { respondToOrLarger } from "../../shared-module/styles/respond"
import { quizTheme } from "../../styles/QuizStyles"
import { MarkdownText } from "../MarkdownText"

import { QuizItemSubmissionComponentProps } from "."

const DIRECTION_COLUMN = "column"
const DIRECTION_ROW = "row"

const gradingOption = css`
  align-items: center;
  border: none;
  display: flex;
  flex: 1;
  justify-content: space-between;
  margin: 0.3rem;
  padding: 1rem;
`

// eslint-disable-next-line i18next/no-literal-string
const gradingOptionWrong = css`
  background: ${quizTheme.gradingWrongItemBackground};
  color: ${quizTheme.gradingWrongItemColor};
`

// eslint-disable-next-line i18next/no-literal-string
const gradingOptionCorrect = css`
  background: ${quizTheme.gradingCorrectItemBackground};
  color: ${quizTheme.gradingCorrectItemColor};
`

const MultipleChoiceSubmission: React.FC<QuizItemSubmissionComponentProps> = ({
  public_quiz_item,
  quiz_item_model_solution,
  user_quiz_item_answer,
}) => {
  const { t } = useTranslation()

  // Column means that all the options are always diplayed on top of each other, regardless of the
  // device width. Sanitized since the value is used in CSS.
  const direction: "row" | "column" =
    public_quiz_item.direction === DIRECTION_COLUMN ? DIRECTION_COLUMN : DIRECTION_ROW

  console.log(public_quiz_item, user_quiz_item_answer)

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
        {public_quiz_item.options.map((qo) => {
          const studentAnswer = user_quiz_item_answer.optionAnswers?.includes(qo.id)
          const correctAnswer = quiz_item_model_solution?.options.some((x) => x.id === qo.id)

          return (
            <div
              key={qo.id}
              className={cx(
                gradingOption,
                // Apply "wrong" style first, conditionally override afterwards
                studentAnswer ? gradingOptionWrong : "",
                correctAnswer ?? studentAnswer ? gradingOptionCorrect : "",
              )}
            >
              <div>{qo.title || qo.body}</div>
              <div>
                <div>{studentAnswer === true && t("student-answer")}</div>
                <div>{correctAnswer === true && t("correct-answer")}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MultipleChoiceSubmission
