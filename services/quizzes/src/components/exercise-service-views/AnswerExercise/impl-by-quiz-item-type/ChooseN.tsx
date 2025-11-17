import { css } from "@emotion/css"
import _ from "lodash"
import React, { useState } from "react"
import { Button, VisuallyHidden } from "react-aria-components"
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
      setAnnouncement(t("choose-n-limit-reached", { count: quizItem.n }))
      setTimeout(() => setAnnouncement(""), 1000)
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
      <VisuallyHidden aria-live="polite" aria-atomic>
        {announcement}
      </VisuallyHidden>
    </div>
  )
}

export default withErrorBoundary(ChooseN)
