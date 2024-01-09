import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerMultiplechoiceDropdown } from "../../../../../types/quizTypes/answer"
import { ModelSolutionQuizItemMultiplechoiceDropdown } from "../../../../../types/quizTypes/modelSolutionSpec"
import { PublicSpecQuizItemMultiplechoiceDropdown } from "../../../../../types/quizTypes/publicSpec"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../../../styles/QuizStyles"

import { QuizItemSubmissionComponentProps } from "."

const SelectIcon = () => {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" role="presentation">
      <path
        d="M8.292 10.293a1.009 1.009 0 000 1.419l2.939 2.965c.218.215.5.322.779.322s.556-.107.769-.322l2.93-2.955a1.01 1.01 0 000-1.419.987.987 0 00-1.406 0l-2.298 2.317-2.307-2.327a.99.99 0 00-1.406 0z"
        fill="#57606f"
        fillRule="evenodd"
      ></path>
    </svg>
  )
}

const MultipleChoiceDropdownFeedback: React.FC<
  React.PropsWithChildren<
    QuizItemSubmissionComponentProps<
      PublicSpecQuizItemMultiplechoiceDropdown,
      UserItemAnswerMultiplechoiceDropdown
    >
  >
> = ({
  public_quiz_item,
  user_quiz_item_answer,
  quiz_item_answer_feedback,
  quiz_item_model_solution,
}) => {
  const { t } = useTranslation()

  const modelSolution = quiz_item_model_solution as ModelSolutionQuizItemMultiplechoiceDropdown
  const correct = quiz_item_answer_feedback
    ? quiz_item_answer_feedback?.score === 1 ??
      quiz_item_answer_feedback.correctnessCoefficient == 1
    : false
  const selectedOption = public_quiz_item.options.filter(
    (o) => o.id === (user_quiz_item_answer.selectedOptionIds as string[])[0],
  )[0]
  const correctOption = modelSolution?.options.find((o) => o.correct)

  return (
    <div>
      <div
        className={css`
          display: grid;
          align-items: center;
          ${respondToOrLarger.sm} {
            flex-direction: row;
          }
        `}
      >
        <div
          className={css`
            flex-direction: column;
            width: 100%;
          `}
        >
          <div
            className={css`
              margin: 0.5rem 0 0 0;
            `}
          >
            {public_quiz_item.title ? (
              <>
                <h2
                  className={css`
                    font-size: ${quizTheme.quizTitleFontSize} !important;
                    font-weight: 500;
                    color: #4c5868;
                    font-family: "Raleway", sans-serif;
                    margin-bottom: 1rem;
                  `}
                >
                  {public_quiz_item.title}
                </h2>
              </>
            ) : null}
          </div>
          {public_quiz_item.body && (
            <div
              className={css`
                margin: 0.5rem;
              `}
            >
              {public_quiz_item.body ? (
                <>
                  <h3
                    className={css`
                      font-size: 1.25rem !important;
                    `}
                  >
                    {public_quiz_item.body}
                  </h3>
                </>
              ) : null}
            </div>
          )}
        </div>
        <div
          className={css`
            display: flex;
            width: 30%;
            align-items: center;
            position: relative;

            .select-arrow {
              position: absolute;
              top: 55%;
              transform: translateY(-50%);
              right: 0.625rem;
              pointer-events: none;
            }
          `}
        >
          <select
            aria-label={t("answer")}
            disabled
            className={css`
              display: grid;
              width: 100%;
              border-radius: 0.25rem;
              border: none;
              padding: 0.5rem 0.625rem;
              font-size: 18px;
              cursor: pointer;
              border: 0.188rem solid
                ${correct
                  ? quizTheme.gradingCorrectItemBorderColor
                  : quizTheme.gradingWrongItemBorderColor};
              background: none;
              min-height: 2.5rem;
              grid-template-areas: "select";
              align-items: center;
              color: #7e8894;
              appearance: none;

              background: ${correct
                ? quizTheme.gradingCorrectItemBackground
                : quizTheme.gradingWrongItemBackground};
            `}
          >
            <option disabled selected={selectedOption.id === null} value="">
              {t("answer")}
            </option>
            {public_quiz_item.options.map((o) => (
              <option
                key={o.id}
                value={o.id}
                selected={selectedOption.id === o.id}
                className={css`
                  display: flex;
                `}
              >
                {o.title || o.body}
              </option>
            ))}
          </select>
          <div className="select-arrow">
            <SelectIcon />
          </div>
        </div>
      </div>
      {correctOption && (
        <div
          className={css`
            margin: 0.5rem;
            margin-bottom: -1rem;
            color: #57606f;
          `}
        >
          {t("correct-option")}: {correctOption?.title || correctOption?.body}
        </div>
      )}
    </div>
  )
}

export default withErrorBoundary(MultipleChoiceDropdownFeedback)
