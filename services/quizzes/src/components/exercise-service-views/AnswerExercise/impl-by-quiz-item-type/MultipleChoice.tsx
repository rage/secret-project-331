import { css, cx } from "@emotion/css"
import _ from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerMultiplechoice } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemMultiplechoice } from "../../../../../types/quizTypes/publicSpec"
import { baseTheme } from "../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../../../styles/QuizStyles"
import { COLUMN, ROW } from "../../../../util/constants"
import { sanitizeFlexDirection } from "../../../../util/css-sanitization"
import { orderArrayWithId } from "../../../../util/randomizer"
import ParsedText from "../../../ParsedText"

import { QuizItemComponentProps } from "."

// const optionButton = css`
//   align-items: center;
//   border: none;
//   display: flex;
//   flex: 1;
//   justify-content: center;
//   margin: 0.3rem 0.3rem 0.3rem 0;
//   padding: 1rem;
//   transition: background-color 0.2s;
//   text-align: left;
//   background-color: transparent;
// `

const optionButton = css`
  appearance: button;
  background-color: #718dbf;
  border: solid transparent;
  border-radius: 8px;
  font-family: "Raleway", sans-serif !important;
  border-width: 3px;
  box-sizing: border-box;
  color: #ffffff;
  cursor: pointer;
  display: inline-block;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.8px;
  line-height: 20px;
  margin: 0;
  outline: none;
  overflow: visible;
  padding: 13px 16px;
  text-align: center;
  touch-action: manipulation;
  transform: translateZ(0);
  transition: filter 0.2s;
  user-select: none;
  -webkit-user-select: none;
  vertical-align: middle;
  white-space: nowrap;
  width: 100%;
  margin-bottom: 10px;
  color: #4c5868;

  &:before {
    background-clip: padding-box;
    background-color: #f1f4f9;
    border-radius: 6px;
    bottom: 3px;
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    z-index: -1;
  }
`

const optionButtonColumn = css`
  ${respondToOrLarger.xs} {
    justify-content: left;
  }
`

// eslint-disable-next-line i18next/no-literal-string
const optionButtonSelected = css`
  background: ${quizTheme.selectedItemBackground};
  color: ${quizTheme.selectedItemColor};
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
          /* font-size: ${quizTheme.quizTitleFontSize}; */
          font-weight: bold;
          font-family: "Raleway", sans-serif;
          font-size: clamp(18px, 2vw, 20px) !important;
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
            font-size: 13px;
            color: ${baseTheme.colors.gray[500]};
            margin: 0.3rem auto;
            width: fit-content;
          `}
        >
          {t("select-all-correct-options")}
        </div>
      )}
    </div>
  )
}

export default withErrorBoundary(MultipleChoice)
