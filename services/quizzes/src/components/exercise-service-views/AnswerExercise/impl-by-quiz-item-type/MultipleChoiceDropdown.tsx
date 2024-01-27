import { css } from "@emotion/css"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerMultiplechoiceDropdown } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemMultiplechoiceDropdown } from "../../../../../types/quizTypes/publicSpec"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../../../styles/QuizStyles"

import { QuizItemComponentProps } from "."
import { respondToOrLarger } from "../../../../shared-module/styles/respond"

const SelectInputIcon = () => {
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
    <div>
      <div>
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
                  font-size: ${quizTheme.quizTitleFontSize} !important;
                  font-weight: 500;
                  color: #4c5868;
                  font-family: "Raleway", sans-serif;
                  margin-bottom: 1rem;
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
                    font-size: 1.25rem !important;
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
          width: 80%;
          align-items: center;
          margin-bottom: 0.5rem;
          position: relative;

          ${respondToOrLarger.sm} {
            width: 40%;
          }

          .select-arrow {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            right: 10px;
            pointer-events: none;
          }
        `}
      >
        <select
          onChange={handleOptionSelect}
          aria-label={t("answer")}
          className={css`
            display: grid;
            width: 100%;
            border-radius: 0.25rem;
            border: none;
            padding: 0.5rem 2rem 0.5rem 0.625rem;
            font-size: 1.125rem;
            cursor: pointer;
            border: 0.188rem solid #dfe1e6;
            background: none;
            min-height: 2.5rem;
            grid-template-areas: "select";
            align-items: center;
            color: #4c5868;
            appearance: none;
            background: transparent;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;

            :hover {
              background: #f9f9f9;
            }
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
            {t("select")}
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
        <div className="select-arrow">
          <SelectInputIcon />
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(MultipleChoiceDropdown)
