import { css } from "@emotion/css"
import _ from "lodash"
import React, { useEffect, useRef, useState } from "react"
import { Button } from "react-aria-components"
import { useTranslation } from "react-i18next"

import { UserItemAnswerChooseN } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemChooseN } from "../../../../../types/quizTypes/publicSpec"

import {
  QUIZ_TITLE_STYLE,
  TWO_DIMENSIONAL_BUTTON_SELECTED,
  TWO_DIMENSIONAL_BUTTON_STYLES,
} from "./AnswerQuizStyles"

import { QuizItemComponentProps } from "."

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const ChooseN: React.FunctionComponent<
  React.PropsWithChildren<QuizItemComponentProps<PublicSpecQuizItemChooseN, UserItemAnswerChooseN>>
> = ({ quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
  const { t } = useTranslation()
  const [announcement, setAnnouncement] = useState<string>("")
  const announcementTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current)
      }
    }
  }, [])

  const handleOptionSelect = (selectedOptionId: string) => {
    if (!quizItemAnswerState) {
      setQuizItemAnswerState({
        quizItemId: quizItem.id,
        type: "choose-n",
        selectedOptionIds: [selectedOptionId],
        valid: 1 == quizItem.n,
      })
      return
    }

    const isSelected = quizItemAnswerState.selectedOptionIds.includes(selectedOptionId)
    const isAtLimit = quizItemAnswerState.selectedOptionIds.length == quizItem.n

    if (!isSelected && isAtLimit) {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current)
      }
      setAnnouncement(t("choose-n-limit-reached", { count: quizItem.n }))
      announcementTimeoutRef.current = setTimeout(() => setAnnouncement(""), 1000)
      return
    }

    const selectedIds = _.xor(quizItemAnswerState.selectedOptionIds, [selectedOptionId])
    const validAnswer = selectedIds.length == quizItem.n

    const newItemAnswer: UserItemAnswerChooseN = {
      ...quizItemAnswerState,
      selectedOptionIds: selectedIds,
      valid: validAnswer,
    }

    setQuizItemAnswerState(newItemAnswer)
    setAnnouncement("")
  }

  return (
    <div
      className={css`
        display: flex;
        flex: 1;
        flex-direction: column;
        ${respondToOrLarger.md} {
          flex-direction: row;
        }
      `}
    >
      <h2
        className={css`
          display: flex;
          ${QUIZ_TITLE_STYLE}
        `}
      >
        {quizItem.title || quizItem.body}
      </h2>
      <div>
        <div
          className={css`
            display: flex;
            flex-wrap: wrap;
          `}
        >
          {quizItem.options.map((o) => {
            const isSelected = quizItemAnswerState?.selectedOptionIds?.includes(o.id) ?? false
            return (
              <Button
                key={o.id}
                onPress={() => handleOptionSelect(o.id)}
                aria-pressed={isSelected}
                className={css`
                  ${TWO_DIMENSIONAL_BUTTON_STYLES}
                  ${isSelected && TWO_DIMENSIONAL_BUTTON_SELECTED}
                `}
              >
                {o.title || o.body}
              </Button>
            )
          })}
        </div>
        {announcement && (
          <div
            aria-live="polite"
            aria-atomic
            className={css`
              margin-top: 1rem;
              padding: 0.875rem;
              border-radius: 0.5rem;
              background-color: #fff4e6;
              border: 2px solid #ffa94d;
              color: #d9480f;
              font-size: 1rem;
              line-height: 1.5;
            `}
          >
            {announcement}
          </div>
        )}
      </div>
    </div>
  )
}

export default withErrorBoundary(ChooseN)
