import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerEssay } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemEssay } from "../../../../../types/quizTypes/publicSpec"

import { QuizItemComponentProps } from "."

import TextArea from "@/shared-module/common/components/InputFields/TextAreaField"
import { headingFont, secondaryFont } from "@/shared-module/common/styles"
import { wordCount } from "@/shared-module/common/utils/strings"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

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
          id="essay"
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
      <div>
        <div
          className={css`
            display: flex;
            color: #4c5868;
            font-family: ${headingFont};
            font-weight: 500;
            margin-bottom: 0.25rem;
          `}
        >
          {t("word-count")}:
        </div>
        <div
          className={css`
            display: flex;
            column-gap: 0.625rem;
          `}
        >
          <div
            className={css`
              display: flex;
              color: #4c5868;
              font-size: 1.125rem;
              line-height: 140%;
              font-weight: 700;
            `}
          >
            {usersWordCount} {t("words")}
          </div>
          <div
            className={css`
              display: flex;
              color: #4c5868;

              span {
                background: #f4f5f7;
                border-radius: 0.25rem;
                margin-right: 0.375rem;
                padding: 0.05rem 0.4rem;
              }

              strong {
                color: #333333;
                margin: 0 0.125rem;
              }
            `}
          >
            <span>
              {t("min-words")}: {quizItem.minWords}
            </span>
            <span>
              {t("max-words")}: {quizItem.maxWords}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(Essay)
