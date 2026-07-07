"use client"

import { css } from "@emotion/css"
import React, { useContext, useEffect, useId, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerEssay } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemEssay } from "../../../../../types/quizTypes/publicSpec"
import QuizzesUserItemAnswerContext from "../../../../contexts/QuizzesUserItemAnswerContext"

import { getEssayPasteWarning } from "./essayPaste"

import { QuizItemComponentProps } from "."

import TextArea from "@/shared-module/common/components/InputFields/TextAreaField"
import { wordCount } from "@/shared-module/common/utils/strings"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import useParentDialog from "@/shared-module/exercise-react/react/hooks/useParentDialog"
import { baseTheme, headingFont, secondaryFont } from "@/shared-module/exercise-react/styles"

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

const ANNOUNCEMENT_PAUSE_MS = 10_000

// Debounces a live-region announcement so it only fires once typing has paused and the message changed.
const usePausedAnnouncement = (message: string, delayMs: number): string => {
  const [announcement, setAnnouncement] = useState("")
  const lastAnnouncedRef = useRef(message)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (message !== lastAnnouncedRef.current) {
        lastAnnouncedRef.current = message
        setAnnouncement(message)
      }
    }, delayMs)
    return () => clearTimeout(timer)
  }, [message, delayMs])

  return announcement
}

const Essay: React.FunctionComponent<
  QuizItemComponentProps<PublicSpecQuizItemEssay, UserItemAnswerEssay>
> = ({ quizItemAnswerState, quizItem, setQuizItemAnswerState }) => {
  const { t } = useTranslation()
  const { port } = useContext(QuizzesUserItemAnswerContext)
  const openDialog = useParentDialog(port)
  const text = quizItemAnswerState?.textData ?? ""
  const usersWordCount = useMemo(() => wordCount(text), [text])
  const titleId = useId()
  const bodyId = useId()
  const labelledBy =
    [quizItem.title ? titleId : null, quizItem.body ? bodyId : null].filter(Boolean).join(" ") ||
    undefined

  const wordCountAnnouncement = useMemo(() => {
    if (quizItem.minWords && usersWordCount < quizItem.minWords) {
      return t("word-count-below-minimum", { count: usersWordCount, min: quizItem.minWords })
    }
    if (quizItem.maxWords && usersWordCount > quizItem.maxWords) {
      return t("word-count-above-maximum", { count: usersWordCount, max: quizItem.maxWords })
    }
    return t("word-count-status", { count: usersWordCount })
  }, [usersWordCount, quizItem.minWords, quizItem.maxWords, t])

  const announcedWordCount = usePausedAnnouncement(wordCountAnnouncement, ANNOUNCEMENT_PAUSE_MS)

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
          id={titleId}
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
          id={bodyId}
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
          onPaste={(e) => {
            // Warn but don't block; pasting a draft is legitimate.
            // eslint-disable-next-line i18next/no-literal-string
            const warning = getEssayPasteWarning(e.clipboardData.getData("text"), t)
            if (warning) {
              void openDialog(warning)
            }
          }}
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
          aria-labelledby={labelledBy}
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
              /* gray[400] for sufficient contrast against the field background */
              border: 0.188rem solid ${baseTheme.colors.gray[400]} !important;
            }
          `}
          value={text}
        />
      </div>
      <div>
        {/* Each fact is its own block so screen readers announce them as separate paragraphs. */}
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
            flex-direction: column;
            row-gap: 0.25rem;
            color: #4c5868;
          `}
        >
          <div
            className={css`
              font-size: 1.125rem;
              line-height: 140%;
              font-weight: 700;
            `}
          >
            {usersWordCount} {t("words")}
          </div>
          {quizItem.minWords !== null && (
            <div>
              {t("min-words")}: {quizItem.minWords}
            </div>
          )}
          {quizItem.maxWords !== null && (
            <div>
              {t("max-words")}: {quizItem.maxWords}
            </div>
          )}
        </div>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={css`
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip-path: rect(0 0 0 0);
            white-space: nowrap;
            border: 0;
          `}
        >
          {announcedWordCount}
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(Essay)
