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
          display: flex;
          flex: 1;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          ${respondToOrLarger.sm} {
            flex-direction: row;
          }
        `}
      >
        <div
          className={css`
            flex-direction: column;
            width: 70%;
          `}
        >
          <div
            className={css`
              margin: 0.5rem 0;
              margin-bottom: 0;
            `}
          >
            {public_quiz_item.title ? (
              <>
                <h2
                  className={css`
                    font-family: "Raleway", sans-serif;
                    font-weight: bold;
                    font-size: ${quizTheme.quizTitleFontSize} !important;
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
                      font-size: clamp(18px, 2vw, 20px) !important;
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
            margin: 0.5rem 0;
          `}
        >
          <select
            aria-label={t("answer")}
            disabled
            className={css`
              display: grid;
              width: 100%;
              border: 1px solid #e0e0e0;
              border-radius: 3px;
              padding: 10px 12px;
              font-size: 18px;
              cursor: not-allowed;
              background: ${correct
                ? quizTheme.gradingCorrectItemBackground
                : quizTheme.gradingWrongItemBackground};
              color: white;
              grid-template-areas: "select";
              align-items: center;
              margin-left: 0.5rem;
            `}
          >
            <option
              disabled
              selected={selectedOption.id === null}
              value=""
              className={css`
                display: flex;
              `}
            >
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
        </div>
      </div>
      {correctOption && (
        <div
          className={css`
            display: flex;
          `}
        >
          <div
            className={css`
              width: 70%;
            `}
          >
            &nbsp;
          </div>
          <div
            className={css`
              margin: 0.5rem;
              margin-bottom: -1rem;
            `}
          >
            {t("correct-option")}: {correctOption?.title || correctOption?.body}
          </div>
        </div>
      )}
    </div>
  )
}

export default withErrorBoundary(MultipleChoiceDropdownFeedback)
