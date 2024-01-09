import { css, cx } from "@emotion/css"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import _ from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerMultiplechoice } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemMultiplechoice } from "../../../../../types/quizTypes/publicSpec"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../../../styles/QuizStyles"
import { COLUMN, ROW } from "../../../../util/constants"
import { sanitizeFlexDirection } from "../../../../util/css-sanitization"
import { orderArrayWithId } from "../../../../util/randomizer"
import ParsedText from "../../../ParsedText"

import {
  QUIZ_TITLE_STYLE,
  TWO_DIMENSIONAL_BUTTON_SELECTED,
  TWO_DIMENSIONAL_BUTTON_STYLES,
} from "./ChooseN"

import { QuizItemComponentProps } from "."

export const optionButton = css`
  ${TWO_DIMENSIONAL_BUTTON_STYLES}
`

const optionButtonColumn = css`
  ${respondToOrLarger.xs} {
    justify-content: left;
  }
`

// eslint-disable-next-line i18next/no-literal-string
const optionButtonSelected = css`
  ${TWO_DIMENSIONAL_BUTTON_SELECTED}
`

export interface LeftBorderedDivProps {
  correct: boolean | undefined
  direction?: string
  message?: string
}

const MultipleChoice: React.FunctionComponent<
  QuizItemComponentProps<PublicSpecQuizItemMultiplechoice, UserItemAnswerMultiplechoice>
> = ({ quizItemAnswerState, quizItem, user_information, setQuizItemAnswerState }) => {
  const { t } = useTranslation()
  // Column means that all the options are always diplayed on top of each other, regardless of the
  // device width.
  const direction = sanitizeFlexDirection(quizItem.optionDisplayDirection, ROW)

  const handleOptionSelect = (event: React.MouseEvent<HTMLButtonElement>) => {
    const selectedOptionId = event.currentTarget.value
    if (!quizItemAnswerState) {
      setQuizItemAnswerState({
        quizItemId: quizItem.id,
        selectedOptionIds: [selectedOptionId],
        type: "multiple-choice",
        valid: true,
      })
      return
    }

    let newItemAnswer: UserItemAnswerMultiplechoice
    // multi is set to true then student can select multiple options for an answer
    if (quizItem.allowSelectingMultipleOptions) {
      const optionAnswers = _.xor(quizItemAnswerState.selectedOptionIds, [selectedOptionId])
      newItemAnswer = {
        ...quizItemAnswerState,
        selectedOptionIds: optionAnswers,
        valid: optionAnswers.length > 0,
      }
    } else {
      newItemAnswer = {
        ...quizItemAnswerState,
        selectedOptionIds: [selectedOptionId],
        valid: true,
      }
    }
    setQuizItemAnswerState(newItemAnswer)
  }

  let quiz_options = quizItem.options
  if (quizItem.shuffleOptions) {
    quiz_options = orderArrayWithId(quiz_options, user_information.pseudonymous_id)
  }

  return (
    <div
      className={css`
        flex: 1;
        margin: 0.7rem 0;
      `}
    >
      <div
        className={css`
          ${QUIZ_TITLE_STYLE}
        `}
      >
        <ParsedText parseLatex parseMarkdown inline text={quizItem.title} />
      </div>
      <p
        className={css`
          color: ${quizTheme.quizBodyColor};
          font-size: ${quizTheme.quizBodyFontSize};
          margin: 0.5rem 0;
        `}
      >
        <ParsedText parseLatex parseMarkdown inline text={quizItem.body} />
      </p>
      <div
        className={css`
          display: flex;
          flex-direction: column;

          ${respondToOrLarger.sm} {
            flex-direction: ${direction};
            ${direction === ROW &&
            `
              column-gap: 0.625rem;
            `}
          }
        `}
      >
        {quiz_options.map((qo) => {
          const selected = quizItemAnswerState?.selectedOptionIds?.includes(qo.id)

          return (
            <button
              key={qo.id}
              value={qo.id}
              onClick={handleOptionSelect}
              aria-pressed={selected ?? false}
              className={cx(
                optionButton,
                selected && optionButtonSelected,
                direction === COLUMN && optionButtonColumn,
              )}
            >
              <ParsedText parseMarkdown parseLatex inline text={qo.title || qo.body || ""} />
            </button>
          )
        })}
      </div>
      {quizItem.allowSelectingMultipleOptions && (
        <div
          className={css`
            font-size: 0.813rem;
            color: #564f23;
            margin: 0.6rem 0;
            width: 100%;
            background: #f6f2da;
            font-size: 1.125rem;
            padding: 0.75rem 0.875rem;
            display: flex;
            align-items: center;
            border-radius: 0.25rem;
            column-gap: 0.6rem;
          `}
        >
          <InfoCircle size={20} weight="bold" color="7A3F75" />
          {t("select-all-correct-options")}
        </div>
      )}
    </div>
  )
}

export default withErrorBoundary(MultipleChoice)
