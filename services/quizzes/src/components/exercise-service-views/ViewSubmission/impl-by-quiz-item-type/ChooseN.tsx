import { css } from "@emotion/css"
import { CheckCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { VisuallyHidden } from "react-aria-components"
import { useTranslation } from "react-i18next"

import { UserItemAnswerChooseN } from "../../../../../types/quizTypes/answer"
import { ModelSolutionQuizItemChooseN } from "../../../../../types/quizTypes/modelSolutionSpec"
import { PublicSpecQuizItemChooseN } from "../../../../../types/quizTypes/publicSpec"
import {
  QUIZ_TITLE_STYLE,
  TWO_DIMENSIONAL_BUTTON_STYLES,
} from "../../AnswerExercise/impl-by-quiz-item-type/AnswerQuizStyles"

import { QuizItemSubmissionComponentProps } from "."

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const MultipleChoiceClickableFeedback: React.FC<
  React.PropsWithChildren<
    QuizItemSubmissionComponentProps<PublicSpecQuizItemChooseN, UserItemAnswerChooseN>
  >
> = ({ user_quiz_item_answer, public_quiz_item, quiz_item_model_solution }) => {
  const { t } = useTranslation()
  const modelSolution = quiz_item_model_solution as ModelSolutionQuizItemChooseN

  const correctOptions: string[] = []
  const incorrectOptions: string[] = []
  let allOptionsCorrect = true

  if (modelSolution) {
    public_quiz_item.options.forEach((option) => {
      const modelOption = modelSolution.options.find((mo) => mo.id === option.id)
      if (modelOption) {
        const optionText = option.title || option.body || ""
        if (modelOption.correct) {
          correctOptions.push(optionText)
        } else {
          incorrectOptions.push(optionText)
          allOptionsCorrect = false
        }
      }
    })
  }

  const shouldShowNotice = modelSolution && !allOptionsCorrect

  return (
    <div
      className={css`
        display: flex;
        flex: 1;
        flex-direction: column;
        ${respondToOrLarger.md} {
          flex-direction: row;
        }
      `}
    >
      <h2
        className={css`
          display: flex;
          ${QUIZ_TITLE_STYLE}
        `}
      >
        {public_quiz_item.title || public_quiz_item.body}
      </h2>

      <div>
        <div
          className={css`
            display: flex;
            flex-wrap: wrap;
          `}
        >
          {public_quiz_item.options.map((o) => {
            const userSelected = user_quiz_item_answer.selectedOptionIds?.includes(o.id)
            const shouldBeSelected = modelSolution?.options.find((mo) => o.id === mo.id)?.correct

            // Undefined if we don't have the model solution i.e. we don't know whether this was supposed to be selected or not
            let isCorrect: boolean | undefined = undefined
            if (shouldBeSelected !== undefined) {
              isCorrect = userSelected === shouldBeSelected
            }
            const defaultBorderColor = "#b8b8c8"

            let borderColor: string
            let backgroundColor: string

            if (shouldBeSelected === undefined) {
              if (userSelected) {
                borderColor = "#2d4a7f"
                backgroundColor = "#e6f2ff"
              } else {
                borderColor = defaultBorderColor
                backgroundColor = "#ffffff"
              }
            } else if (shouldBeSelected) {
              if (isCorrect) {
                borderColor = "#16a34a"
                backgroundColor = "#f0fdf4"
              } else {
                borderColor = "#bbf7d0"
                backgroundColor = "#ffffff"
              }
            } else {
              if (isCorrect) {
                borderColor = "#fecaca"
                backgroundColor = "#ffffff"
              } else {
                borderColor = "#c53030"
                backgroundColor = "#fff5f5"
              }
            }

            return (
              <div
                key={o.id}
                className={css`
                  ${TWO_DIMENSIONAL_BUTTON_STYLES}
                  background: ${backgroundColor};
                  border-color: ${borderColor};
                  box-shadow:
                    rgba(45, 35, 66, 0) 0 2px 4px,
                    rgba(45, 35, 66, 0) 0 7px 13px -3px,
                    ${borderColor} 0 -2px 0 inset;
                  color: #2d3a4a;
                  ${userSelected && "font-weight: 600;"}
                  cursor: default;
                  pointer-events: none;
                `}
              >
                <span
                  className={css`
                    flex: 1;
                    text-align: center;
                  `}
                >
                  {o.title || o.body}
                </span>
                {userSelected && (
                  <span
                    className={css`
                      position: absolute;
                      right: 0.875rem;
                      top: 50%;
                      transform: translateY(-50%);
                      display: flex;
                      align-items: center;
                      width: 1.25rem;
                      height: 1.25rem;
                      color: ${shouldBeSelected === undefined
                        ? "#2d4a7f"
                        : isCorrect
                          ? "#16a34a"
                          : "#c53030"};
                    `}
                  >
                    {shouldBeSelected === undefined || isCorrect ? (
                      <CheckCircle size={20} />
                    ) : (
                      <XmarkCircle size={20} />
                    )}
                    <VisuallyHidden>{t("choose-n-selected")}</VisuallyHidden>
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {shouldShowNotice && (
          <div
            className={css`
              margin-top: 1rem;
              padding: 1rem;
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 0.375rem;
            `}
          >
            {correctOptions.length > 0 && (
              <div
                className={css`
                  margin-bottom: ${incorrectOptions.length > 0 ? "0.75rem" : "0"};
                `}
              >
                <strong>{t("choose-n-correct-options-label")}</strong> {correctOptions.join(", ")}
              </div>
            )}
            {incorrectOptions.length > 0 && (
              <div>
                <strong>{t("choose-n-incorrect-options-label")}</strong>{" "}
                {incorrectOptions.join(", ")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default withErrorBoundary(MultipleChoiceClickableFeedback)
