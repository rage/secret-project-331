import { css, cx } from "@emotion/css"
import React, { useId } from "react"
import { VisuallyHidden } from "react-aria-components"
import { useTranslation } from "react-i18next"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { primaryFont } from "@/shared-module/exercise-react/styles"
import type { FlexDirection } from "@/util/css-sanitization"
import { sanitizeFlexDirection } from "@/util/css-sanitization"
import { resolveDisplayedFeedback } from "@/util/feedbackMessages"
import { orderArrayWithId } from "@/util/randomizer"

import type { QuizItemSubmissionComponentProps } from "."
import type { UserItemAnswerMultiplechoice } from "../../../../../types/quizTypes/answer"
import type { ModelSolutionQuizItemMultiplechoice } from "../../../../../types/quizTypes/modelSolutionSpec"
import type { PublicSpecQuizItemMultiplechoice } from "../../../../../types/quizTypes/publicSpec"
import { quizTheme } from "../../../../styles/QuizStyles"
import ParsedText from "../../../ParsedText"
import {
  AnswerSummary,
  SUMMARY_MODE,
  buildSummary,
  resolveLine2Label,
  toSummaryOption,
} from "../AnswerSummary"
import {
  CHIP,
  OptionChip,
  OptionMarker,
  optionBoxStyles,
  optionLabelStyles,
  optionStateStyles,
  optionTextStyles,
  resolveOptionCorrectness,
  resolveSelectedOptionCorrectness,
} from "../OptionStatus"

const MultipleChoiceSubmission: React.FC<
  React.PropsWithChildren<
    QuizItemSubmissionComponentProps<PublicSpecQuizItemMultiplechoice, UserItemAnswerMultiplechoice>
  >
> = ({
  public_quiz_item,
  quiz_item_model_solution,
  user_quiz_item_answer,
  quiz_item_answer_feedback,
  user_information,
}) => {
  const { t } = useTranslation()
  const titleId = useId()

  const modelSolution = quiz_item_model_solution as ModelSolutionQuizItemMultiplechoice
  // Column means that all the options are always diplayed on top of each other, regardless of the
  // device width. Sanitized since the value is used in CSS.
  const direction: FlexDirection = sanitizeFlexDirection(
    public_quiz_item.optionDisplayDirection,
    // oxlint-disable-next-line i18next/no-literal-string
    "row",
  )

  let quiz_options = public_quiz_item.options
  if (public_quiz_item.shuffleOptions) {
    quiz_options = orderArrayWithId(quiz_options, user_information.pseudonymous_id)
  }

  const isSelected = (id: string) => user_quiz_item_answer.selectedOptionIds?.includes(id) ?? false
  const feedbackFor = (id: string) =>
    quiz_item_answer_feedback?.quiz_item_option_feedbacks?.find((f) => f.option_id === id)
  const multi = public_quiz_item.allowSelectingMultipleOptions
  const summaryLines = quiz_item_model_solution ? buildSummaryLines() : []

  function buildSummaryLines() {
    const keyFor = (id: string) => modelSolution.options.find((x) => x.id === id) ?? null
    const text = (qo: (typeof quiz_options)[number]) => toSummaryOption(qo, true)
    const chosen = quiz_options.filter((qo) => isSelected(qo.id))
    const chosenCorrect = chosen.filter((qo) => keyFor(qo.id)?.correct === true).length
    return buildSummary({
      chosen: chosen.map((qo) => ({
        ...text(qo),
        correct: multi
          ? resolveOptionCorrectness(keyFor(qo.id), feedbackFor(qo.id))
          : resolveSelectedOptionCorrectness(
              keyFor(qo.id),
              feedbackFor(qo.id),
              quiz_item_answer_feedback,
            ),
      })),
      unselectedCorrect: quiz_options
        .filter((qo) => !isSelected(qo.id) && keyFor(qo.id)?.correct === true)
        .map((qo) => text(qo)),
      incorrect: quiz_options
        .filter((qo) => keyFor(qo.id)?.correct === false)
        .map((qo) => text(qo)),
      line2Label: resolveLine2Label({
        mode: multi ? SUMMARY_MODE.multi : SUMMARY_MODE.single,
        lenient:
          public_quiz_item.multipleChoiceMultipleOptionsGradingPolicy ===
          "some-correct-none-incorrect",
        chosenCorrect,
        totalCorrect: modelSolution.options.filter((o) => o.correct === true).length,
      }),
    })
  }

  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role=group on a styled div; fieldset alters layout
      role="group"
      aria-labelledby={titleId}
      className={css`
        margin: 0.5rem 0;
      `}
    >
      <div
        id={titleId}
        className={css`
          font-weight: 500;
          color: #4c5868;
          font-family: ${primaryFont};
          font-size: 1.25rem;
          margin-bottom: 1rem;
        `}
      >
        <ParsedText inline parseLatex parseMarkdown text={public_quiz_item.title} />
      </div>
      <div
        className={css`
          color: ${quizTheme.quizBodyColor};
          font-size: ${quizTheme.quizBodyFontSize};
          margin: 0.5rem 0;
        `}
      >
        {public_quiz_item.body && (
          <ParsedText inline parseLatex parseMarkdown text={public_quiz_item.body} />
        )}
      </div>
      <div
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role=list on a styled flex div; <ul> alters layout
        role="list"
        className={css`
          display: flex;
          flex-direction: column;

          ${respondToOrLarger.sm} {
            flex-direction: ${direction};
            ${
              public_quiz_item.optionDisplayDirection === "horizontal" &&
              `
                flex-wrap: wrap;
              `
            }
          }
        `}
      >
        {quiz_options.map((qo) => {
          const answerSelectedThisOption =
            user_quiz_item_answer.selectedOptionIds?.includes(qo.id) ?? false
          const modelSolutionForThisOption =
            modelSolution?.options.find((x) => x.id === qo.id) ?? null
          const feedbackForThisOption = quiz_item_answer_feedback?.quiz_item_option_feedbacks?.find(
            (f) => f.option_id === qo.id,
          )
          // null means we don't know whether this option was correct
          // Item score only says something about one option when a single option is selected.
          const correctAnswer =
            answerSelectedThisOption && !multi
              ? resolveSelectedOptionCorrectness(
                  modelSolutionForThisOption,
                  feedbackForThisOption,
                  quiz_item_answer_feedback,
                )
              : resolveOptionCorrectness(modelSolutionForThisOption, feedbackForThisOption)
          let chip: React.ReactNode = null
          if (answerSelectedThisOption) {
            if (correctAnswer === true) {
              chip = <OptionChip kind={CHIP.correct}>{t("option-result-correct")}</OptionChip>
            } else if (correctAnswer === false) {
              chip = <OptionChip kind={CHIP.incorrect}>{t("option-result-incorrect")}</OptionChip>
            }
          }
          let prefix: string | null = null
          if (answerSelectedThisOption) {
            prefix = t("option-selected")
          } else if (multi) {
            prefix = t("option-not-selected")
          }
          let feedBackForOption: string | null = null
          if (answerSelectedThisOption) {
            feedBackForOption = resolveDisplayedFeedback(
              feedbackForThisOption?.option_feedback,
              modelSolutionForThisOption?.messagesOnModelSolution,
            )
          }
          return (
            <div
              key={qo.id}
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role=listitem on a styled div; <li> needs a <ul> parent
              role="listitem"
            >
              <div
                className={cx(
                  optionBoxStyles,
                  optionLabelStyles,
                  answerSelectedThisOption && optionStateStyles(correctAnswer),
                )}
              >
                <div className={optionLabelStyles}>
                  <OptionMarker selected={answerSelectedThisOption} multi={multi} />
                  <div className={optionTextStyles}>
                    {prefix && <VisuallyHidden>{prefix}</VisuallyHidden>}
                    <ParsedText inline parseMarkdown parseLatex text={qo.title || qo.body || ""} />
                  </div>
                </div>
                {chip}
              </div>
              <RowSubmissionFeedback correct={correctAnswer} feedback={feedBackForOption} />
            </div>
          )
        })}
      </div>
      <AnswerSummary lines={summaryLines} />
    </div>
  )
}

interface RowSubmissionFeedbackProps {
  feedback: string | null | undefined
  correct: boolean | null
}

const RowSubmissionFeedback: React.FC<React.PropsWithChildren<RowSubmissionFeedbackProps>> = ({
  feedback,
  correct,
}) => {
  return feedback ? (
    <div
      className={css`
        margin: 0 0.5rem 1rem 0;
        display: flex;
        color: #4c5868;
        font-size: 1.125rem;
        border-left: 0.375rem solid
          ${
            correct === null
              ? "#b8b8c8"
              : correct
                ? quizTheme.gradingCorrectItemBorderColor
                : "#ebcbcd"
          };
        box-sizing: border-box;
        background: ${quizTheme.feedbackBackground};
        padding: 0.5rem 0px 0.5rem 0.5rem;
      `}
    >
      <ParsedText inline parseLatex parseMarkdown addDotToEnd text={feedback} />
    </div>
  ) : null
}

export default withErrorBoundary(MultipleChoiceSubmission)
