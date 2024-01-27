import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerMultiplechoiceDropdown } from "../../../../../types/quizTypes/answer"
import { ItemAnswerFeedback } from "../../../../../types/quizTypes/grading"
import { ModelSolutionQuizItemMultiplechoiceDropdown } from "../../../../../types/quizTypes/modelSolutionSpec"
import {
  PublicQuizItemOption,
  PublicSpecQuizItemMultiplechoiceDropdown,
} from "../../../../../types/quizTypes/publicSpec"
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
  const correct =
    quiz_item_answer_feedback?.score === 1 || quiz_item_answer_feedback?.correctnessCoefficient == 1
  const selectedOption = public_quiz_item.options.filter(
    (o) => o.id === (user_quiz_item_answer.selectedOptionIds as string[])[0],
  )[0]
  const correctOption = modelSolution?.options.find((o) => o.correct)
  const quiz_options = public_quiz_item.options

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
            width: 80%;
            align-items: center;
            position: relative;

            ${respondToOrLarger.sm} {
              width: 40%;
            }

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
              padding: 0.5rem 2rem 0.5rem 0.625rem;
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
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;

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
            margin: 0.5rem 0.5rem 0.5rem 0;
            color: #57606f;
          `}
        >
          {t("correct-option")}: {correctOption?.title || correctOption?.body}
        </div>
      )}
      <SubmissionFeedbackMessage
        quiz_options={quiz_options}
        user_quiz_item_answer={user_quiz_item_answer}
        modelSolution={modelSolution}
        quiz_item_answer_feedback={quiz_item_answer_feedback ?? null}
      />
    </div>
  )
}

interface SubmissionFeedbackMessageProps {
  quiz_options: PublicQuizItemOption[]
  user_quiz_item_answer: UserItemAnswerMultiplechoiceDropdown
  modelSolution: ModelSolutionQuizItemMultiplechoiceDropdown
  quiz_item_answer_feedback: ItemAnswerFeedback | null
}

const SubmissionFeedbackMessage: React.FC<
  React.PropsWithChildren<SubmissionFeedbackMessageProps>
> = ({ quiz_options, user_quiz_item_answer, modelSolution, quiz_item_answer_feedback }) => {
  return quiz_options.map((option) => {
    const answerSelectedThisOption =
      user_quiz_item_answer.selectedOptionIds?.includes(option.id) ?? false
    const modelSolutionForThisOption =
      modelSolution?.options.find((x) => x.id === option.id) ?? null
    // If correctAnswer is null we don't know whether this option was correct or not
    let correctAnswer = modelSolutionForThisOption?.correct ?? null
    const feedbackForThisOption = quiz_item_answer_feedback?.quiz_item_option_feedbacks?.find(
      (feedback) => feedback.option_id === option.id,
    )
    if (feedbackForThisOption && feedbackForThisOption.this_option_was_correct !== null) {
      // if we have received feedback for this option, use that
      // However, if the model solution thinks this option is correct and the feedback says it's not, we'll trust the model solution
      if (!correctAnswer) {
        correctAnswer = feedbackForThisOption.this_option_was_correct
      }
    }
    let feedBackForOption: string | null = null
    if (answerSelectedThisOption) {
      feedBackForOption = feedbackForThisOption?.option_feedback ?? null
      if (modelSolutionForThisOption?.additionalCorrectnessExplanationOnModelSolution) {
        feedBackForOption =
          modelSolutionForThisOption.additionalCorrectnessExplanationOnModelSolution
      }
    }
    return feedBackForOption ? (
      <div
        className={css`
          margin: 0.5rem 0.5rem 1rem 0;
          display: flex;
          border-left: ${correctAnswer
            ? `6px solid ${quizTheme.gradingCorrectItemBackground}`
            : `6px solid #ebcbcd`};
          box-sizing: border-box;
          background: ${quizTheme.feedbackBackground};
          padding: 0.5rem 0px 0.5rem 0.5rem;
        `}
      >
        <p>{feedBackForOption}</p>
      </div>
    ) : null
  })
}

export default withErrorBoundary(MultipleChoiceDropdownFeedback)
