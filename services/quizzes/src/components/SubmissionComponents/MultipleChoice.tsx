import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { respondToOrLarger } from "../../shared-module/styles/respond"
import { quizTheme } from "../../styles/QuizStyles"
import MarkdownText from "../MarkdownText"

import { QuizItemSubmissionComponentProps } from "."

const DIRECTION_COLUMN = "column"
const DIRECTION_ROW = "row"

const gradingOption = css`
  align-items: center;
  background: ${quizTheme.quizItemBackground};
  border: none;
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  justify-content: space-between;
  margin: 0.3rem;
  padding: 0 1rem;
`

// eslint-disable-next-line i18next/no-literal-string
const gradingOptionWrong = css`
  background: ${quizTheme.gradingWrongItemBackground};
  color: ${quizTheme.gradingWrongItemColor};
`

// eslint-disable-next-line i18next/no-literal-string
const gradingOptionSelected = css`
  background: ${quizTheme.gradingSelectedItemBackground};
  color: ${quizTheme.gradingSelectedItemColor};
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

  console.log(public_quiz_item)
  console.log(quiz_item_model_solution)
  console.log(user_quiz_item_answer)
  const feedbackDisplayPolicy = quiz_item_model_solution?.feedbackDisplayPolicy
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
          const selectedAnswer = user_quiz_item_answer.optionAnswers?.includes(qo.id) ?? false
          const correctAnswerExists = (quiz_item_model_solution?.options.length ?? 0) > 0
          const correctAnswer =
            quiz_item_model_solution?.options.some((x) => x.id === qo.id && x.correct) ?? false

          const submissionFeedback = quiz_item_model_solution?.options.find(
            (option) => option.id === qo.id,
          )

          return (
            <>
              <div
                key={qo.id}
                className={cx(
                  gradingOption,
                  selectedAnswer ? gradingOptionSelected : "",
                  selectedAnswer && correctAnswerExists ? gradingOptionWrong : "",
                  correctAnswer ? gradingOptionCorrect : "",
                )}
              >
                <div
                  className={css`
                    padding: 1rem 0;
                  `}
                >
                  <MarkdownText text={qo.title || qo.body || ""} />
                </div>
                <div
                  className={css`
                    display: flex;
                    flex-direction: column;
                  `}
                >
                  <div>{selectedAnswer && t("student-answer")}</div>
                  <div>{correctAnswer && t("correct-answer")}</div>
                </div>
              </div>
              <div>
                {feedbackDisplayPolicy === "DisplayFeedbackOnQuizItem" && submissionFeedback ? (
                  <>
                    {selectedAnswer ? (
                      <div
                        className={css`
                          margin-left: 2em;
                          display: flex;
                          border-left: ${submissionFeedback.correct
                            ? `6px solid #1F6964`
                            : `6px solid #A84835`};
                          box-sizing: border-box;
                          padding: 0.5rem 0px 0.5rem 0.5rem;
                          margin-bottom: 5px !important;
                        `}
                      >
                        <p>
                          {submissionFeedback.correct
                            ? submissionFeedback.successMessage
                            : submissionFeedback.failureMessage}
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {feedbackDisplayPolicy === "DisplayFeedbackOnAllOptions" && submissionFeedback ? (
                  <div
                    className={css`
                      margin-left: 2em;
                      display: flex;
                      border-left: ${submissionFeedback.correct
                        ? `6px solid #1F6964`
                        : `6px solid #A84835`};
                      box-sizing: border-box;
                      padding: 0.5rem 0px 0.5rem 0.5rem;
                      margin-bottom: 5px !important;
                    `}
                  >
                    <p>
                      {submissionFeedback.correct
                        ? submissionFeedback.successMessage
                        : submissionFeedback.failureMessage}
                    </p>
                  </div>
                ) : null}
              </div>
            </>
          )
        })}
      </div>
    </div>
  )
}

export default MultipleChoiceSubmission
