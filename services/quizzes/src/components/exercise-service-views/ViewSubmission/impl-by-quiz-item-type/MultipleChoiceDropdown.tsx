import { css, cx } from "@emotion/css"
import React, { useId } from "react"
import { VisuallyHidden } from "react-aria-components"
import { useTranslation } from "react-i18next"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { primaryFont } from "@/shared-module/exercise-react/styles"
import { resolveDisplayedFeedback } from "@/util/feedbackMessages"

import type { QuizItemSubmissionComponentProps } from "."
import type { UserItemAnswerMultiplechoiceDropdown } from "../../../../../types/quizTypes/answer"
import type { ItemAnswerFeedback } from "../../../../../types/quizTypes/grading"
import type { ModelSolutionQuizItemMultiplechoiceDropdown } from "../../../../../types/quizTypes/modelSolutionSpec"
import type {
  PublicQuizItemOption,
  PublicSpecQuizItemMultiplechoiceDropdown,
} from "../../../../../types/quizTypes/publicSpec"
import { quizTheme } from "../../../../styles/QuizStyles"
import ParsedText from "../../../ParsedText"
import {
  CHIP,
  OptionChip,
  OptionMarker,
  optionBoxStyles,
  optionStateStyles,
  optionTextStyles,
  resolveOptionCorrectness,
  resolveSelectedOptionCorrectness,
} from "../OptionStatus"

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
  const titleId = useId()
  const bodyId = useId()

  const modelSolution = quiz_item_model_solution as ModelSolutionQuizItemMultiplechoiceDropdown
  const selectedOption = public_quiz_item.options.filter(
    (o) => o.id === (user_quiz_item_answer.selectedOptionIds as string[])[0],
  )[0]
  const correctOption = modelSolution?.options.find((o) => o.correct)
  // null means we don't know whether the answer was correct
  const correct = selectedOption
    ? resolveSelectedOptionCorrectness(
        modelSolution?.options.find((o) => o.id === selectedOption.id),
        quiz_item_answer_feedback?.quiz_item_option_feedbacks?.find(
          (f) => f.option_id === selectedOption.id,
        ),
        quiz_item_answer_feedback,
      )
    : null
  const quiz_options = public_quiz_item.options

  return (
    <div>
      <div
        className={css`
          margin: 0.5rem 0 0 0;
        `}
      >
        {public_quiz_item.title ? (
          <div
            id={titleId}
            className={css`
              font-size: ${quizTheme.quizTitleFontSize} !important;
              font-weight: 500;
              color: #4c5868;
              font-family: ${primaryFont};
              margin-bottom: 1rem;
            `}
          >
            {public_quiz_item.title}
          </div>
        ) : null}
      </div>
      {public_quiz_item.body && (
        <div
          className={css`
            margin: 0.5rem;
          `}
        >
          <p
            id={bodyId}
            className={css`
              font-size: 1.25rem;
              margin: 0;
            `}
          >
            {public_quiz_item.body}
          </p>
        </div>
      )}
      <div
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role=group on a styled div; fieldset alters layout
        role="group"
        aria-labelledby={public_quiz_item.title ? titleId : undefined}
        aria-label={public_quiz_item.title ? undefined : t("answer")}
        aria-describedby={public_quiz_item.body ? bodyId : undefined}
        className={cx(
          optionBoxStyles,
          css`
            max-width: 50ch;
          `,
          selectedOption && optionStateStyles(correct),
        )}
      >
        <OptionMarker selected={!!selectedOption} multi={false} />
        <div className={optionTextStyles}>
          {selectedOption ? (
            <>
              <VisuallyHidden>{t("option-selected")}</VisuallyHidden>
              {selectedOption.title || selectedOption.body}
            </>
          ) : (
            <span
              className={css`
                color: #7e8894;
              `}
            >
              {t("answer")}
            </span>
          )}
        </div>
        {selectedOption && correct === true && (
          <OptionChip kind={CHIP.correct}>{t("option-result-correct")}</OptionChip>
        )}
        {selectedOption && correct === false && (
          <OptionChip kind={CHIP.wrong}>{t("option-result-wrong")}</OptionChip>
        )}
      </div>
      {correctOption && (
        <div
          className={css`
            margin: 0.5rem 0.5rem 0.5rem 0;
            font-size: 1.125rem;
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
    const feedbackForThisOption = quiz_item_answer_feedback?.quiz_item_option_feedbacks?.find(
      (feedback) => feedback.option_id === option.id,
    )
    const correctAnswer = answerSelectedThisOption
      ? resolveSelectedOptionCorrectness(
          modelSolutionForThisOption,
          feedbackForThisOption,
          quiz_item_answer_feedback,
        )
      : resolveOptionCorrectness(modelSolutionForThisOption, feedbackForThisOption)
    let feedBackForOption: string | null = null
    if (answerSelectedThisOption) {
      feedBackForOption = resolveDisplayedFeedback(
        feedbackForThisOption?.option_feedback,
        modelSolutionForThisOption?.messagesOnModelSolution,
      )
    }
    return feedBackForOption ? (
      <div
        key={option.id}
        className={css`
          margin: 0.5rem 0.5rem 1rem 0;
          display: flex;
          font-size: 1.125rem;
          color: #3c4551;
          border-left: 6px solid
            ${
              correctAnswer === null
                ? "#b8b8c8"
                : correctAnswer
                  ? quizTheme.gradingCorrectItemBackground
                  : "#ebcbcd"
            };
          box-sizing: border-box;
          background: ${quizTheme.feedbackBackground};
          padding: 0.5rem 0px 0.5rem 0.5rem;
        `}
      >
        <ParsedText inline blockContainer parseLatex parseMarkdown text={feedBackForOption} />
      </div>
    ) : null
  })
}

export default withErrorBoundary(MultipleChoiceDropdownFeedback)
