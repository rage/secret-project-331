import { css } from "@emotion/css"
import { CheckCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import React from "react"
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

            const isCorrect =
              shouldBeSelected === undefined ? undefined : userSelected === shouldBeSelected
            const defaultBorderColor = "#b8b8c8"

            let borderColor: string
            let backgroundColor: string

            if (shouldBeSelected === undefined) {
              borderColor = userSelected ? "#2d4a7f" : defaultBorderColor
              backgroundColor = userSelected ? "#e6f2ff" : "#ffffff"
            } else if (isCorrect) {
              borderColor = userSelected ? "#16a34a" : "#bbf7d0"
              backgroundColor = userSelected ? "#f0fdf4" : "#ffffff"
            } else {
              borderColor = userSelected ? "#c53030" : "#fecaca"
              backgroundColor = userSelected ? "#fff5f5" : "#ffffff"
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
                {userSelected && shouldBeSelected !== undefined && (
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
                      color: ${isCorrect ? "#16a34a" : "#c53030"};
                    `}
                    aria-label={
                      isCorrect ? t("choose-n-selected-correct") : t("choose-n-selected-incorrect")
                    }
                  >
                    {isCorrect ? <CheckCircle size={20} /> : <XmarkCircle size={20} />}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(MultipleChoiceClickableFeedback)
