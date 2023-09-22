import { css } from "@emotion/css"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerMultiplechoiceDropdown } from "../../../types/quizTypes/answer"
import { PublicSpecQuizItemMultiplechoiceDropdown } from "../../../types/quizTypes/publicSpec"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../styles/QuizStyles"

import { QuizItemComponentProps } from "."

const MultipleChoiceDropdown: React.FunctionComponent<
  React.PropsWithChildren<
    QuizItemComponentProps<
      PublicSpecQuizItemMultiplechoiceDropdown,
      UserItemAnswerMultiplechoiceDropdown
    >
  >
> = ({ quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
  const { t } = useTranslation()
  const handleOptionSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptionId = event.currentTarget.value
    if (!quizItemAnswerState) {
      setQuizItemAnswerState({
        quizItemId: quizItem.id,
        selectedOptionIds: [selectedOptionId],
        type: "multiple-choice-dropdown",
        valid: true,
      })
      return
    }

    const newItemAnswer: UserItemAnswerMultiplechoiceDropdown = {
      ...quizItemAnswerState,
      selectedOptionIds: [selectedOptionId],
      valid: true,
    }
    setQuizItemAnswerState(newItemAnswer)
  }
  const selectedOptionId = useMemo(() => {
    const optionAnswers = quizItemAnswerState?.selectedOptionIds
    if (!optionAnswers || !Array.isArray(optionAnswers) || optionAnswers.length === 0) {
      return null
    }
    return optionAnswers[0] ?? null
  }, [quizItemAnswerState?.selectedOptionIds])
  return (
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
          {quizItem.title ? (
            <>
              <h2
                className={css`
                  font-family: "Raleway", sans-serif;
                  font-weight: bold;
                  font-size: ${quizTheme.quizTitleFontSize} !important;
                `}
              >
                {quizItem.title}
              </h2>
            </>
          ) : null}
        </div>
        {quizItem.body && (
          <div
            className={css`
              margin: 0.5rem;
            `}
          >
            {quizItem.body ? (
              <>
                <h3
                  className={css`
                    font-size: clamp(18px, 2vw, 20px) !important;
                  `}
                >
                  {quizItem.body}
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
          onChange={handleOptionSelect}
          aria-label={t("answer")}
          className={css`
            display: grid;
            width: 100%;
            border: 1px solid #e0e0e0;
            border-radius: 3px;
            padding: 10px 12px;
            font-size: 18px;
            cursor: pointer;
            background: #f9f9f9;
            grid-template-areas: "select";
            align-items: center;
            margin-left: 0.5rem;
          `}
        >
          <option
            disabled
            selected={selectedOptionId === null}
            value=""
            className={css`
              display: flex;
            `}
          >
            {t("answer")}
          </option>
          {quizItem.options.map((o) => (
            <option
              key={o.id}
              value={o.id}
              selected={selectedOptionId === o.id}
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
  )
}

export default withErrorBoundary(MultipleChoiceDropdown)
