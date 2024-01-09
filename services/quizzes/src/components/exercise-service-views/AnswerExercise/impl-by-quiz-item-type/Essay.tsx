import { css, cx } from "@emotion/css"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerEssay } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemEssay } from "../../../../../types/quizTypes/publicSpec"
import TextArea from "../../../../shared-module/components/InputFields/TextAreaField"
import { headingFont, secondaryFont } from "../../../../shared-module/styles"
import { wordCount } from "../../../../shared-module/utils/strings"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import { QuizItemComponentProps } from "."

export const container = css`
  font-size: 0.563rem;
  text-align: center;
  font-family: ${secondaryFont} !important;
  text-transform: uppercase;
  border-radius: 0.625rem;
  height: 2.938rem;
  width: 5.625rem;
  display: flex;
  flex-direction: column;

  p {
    padding: 0.375rem 0.625rem 0px 0.625rem;
    border-top-right-radius: 0.625rem;
    border-top-left-radius: 0.625rem;
  }

  span {
    font-family: ${headingFont} !important;
    color: #fff;
    font-weight: 500;
    font-size: 0.938rem;
    margin: 0;
  }
`

const Essay: React.FunctionComponent<
  QuizItemComponentProps<PublicSpecQuizItemEssay, UserItemAnswerEssay>
> = ({ quizItemAnswerState, quizItem, setQuizItemAnswerState }) => {
  const { t } = useTranslation()
  const text = quizItemAnswerState?.textData ?? ""
  const usersWordCount = useMemo(() => wordCount(text), [text])
  let isValid = null

  if (quizItem?.minWords && quizItem.maxWords) {
    isValid = usersWordCount >= quizItem?.minWords && usersWordCount <= quizItem.maxWords
  }

  if (usersWordCount < 1) {
    isValid = null
  }

  console.log(isValid, usersWordCount)

  return (
    <div
      className={css`
        display: flex;
        flex: 1;
        flex-direction: column;
      `}
    >
      {quizItem.title && (
        <div
          className={css`
            display: flex;
            margin: 0.5rem 0;
            font-size: 1.25rem;
          `}
        >
          {quizItem.title}
        </div>
      )}
      {quizItem.body && (
        <div
          className={css`
            display: flex;
            margin: 0.5rem 0;
            font-size: 1.25rem;
          `}
        >
          {quizItem.body}
        </div>
      )}
      <div
        className={css`
          display: flex;
          margin: 0.5rem 0;
        `}
      >
        <TextArea
          key={"text-area-" + quizItem.id}
          onChangeByValue={(newValue) => {
            let valid = true
            if (quizItem.minWords && quizItem.minWords > wordCount(newValue)) {
              valid = false
            }
            if (quizItem.maxWords && quizItem.maxWords < wordCount(newValue)) {
              valid = false
            }
            if (!quizItemAnswerState) {
              setQuizItemAnswerState({
                textData: newValue,
                valid,
                quizItemId: quizItem.id,
                type: "essay",
              })
              return
            }

            const newQuizItemAnswerState: UserItemAnswerEssay = {
              ...quizItemAnswerState,
              textData: newValue,
              valid: valid,
            }
            setQuizItemAnswerState(newQuizItemAnswerState)
          }}
          placeholder={t("answer")}
          aria-label={t("answer")}
          rows={5}
          autoResize
          className={css`
            width: 100%;
            textarea {
              width: 100%;
              height: 12.5rem;
              resize: vertical;
              background: #f4f5f7 !important;
              border-radius: 0.25rem;
              border: 0.188rem solid #dfe1e6 !important;
              outline: none;
            }
          `}
          value={text}
        />
      </div>
      <div
        className={css`
          display: flex;
          column-gap: 10px;
        `}
      >
        <div
          className={cx(
            css`
              margin: 0.5rem 0;
              text-transform: uppercase;
              background: ${isValid === null ? "#f1f1f3" : isValid ? " #66B8B2" : "#746FB0"};

              p {
                background: ${isValid === null ? "#c4c4c6" : isValid ? "#50938E" : "#5D5890"};
                color: ${isValid === null ? "#57606f" : isValid ? "#fff" : "#fff"};
              }

              span {
                color: ${isValid === null ? "#57606f" : isValid ? "#fff" : "#fff"} !important;
              }
            `,
            container,
          )}
        >
          <p>{t("word-count")}</p>
          <span>{usersWordCount}</span>
        </div>
        <div
          className={cx(
            css`
              margin: 0.5rem 0;
              text-transform: uppercase;
              background: #f1f1f3;
              color: #57606f;

              p {
                background: #c4c4c6;
                color: #57606f;
              }

              span {
                color: #57606f !important;
              }
            `,
            container,
          )}
        >
          <p>{t("min-words")}</p>
          <span>{quizItem.minWords}</span>
        </div>
        <div
          className={cx(
            css`
              margin: 0.5rem 0;
              text-transform: uppercase;
              background: #f1f1f3;
              color: #57606f;

              p {
                background: #c4c4c6;
                color: #57606f;
              }

              span {
                color: #57606f !important;
              }
            `,
            container,
          )}
        >
          <p>{t("max-words")}</p>
          <span>{quizItem.maxWords}</span>
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(Essay)
