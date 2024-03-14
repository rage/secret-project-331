import styled from "@emotion/styled"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import { PrivateSpecQuiz, QuizItemType } from "../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../hooks/useQuizzesExerciseServiceOutputState"
import { headingFont } from "../../../../shared-module/styles"
import { createEmptyQuizItem } from "../utils/general"

export interface QuizOption {
  type: QuizItemType
  name: string
  description: string
  category: string
  disabled: boolean
}

interface QuizOptionProps {
  quizOption: QuizOption
}

interface QuizCardProps {
  disabled?: boolean
}

const QuizCard = styled.div<QuizCardProps>`
  all: unset;
  width: auto;
  height: auto;
  background-color: #f5f6f7;
  padding: 16px;
  margin: 5px;
  ${(props) =>
    Boolean(props.disabled) &&
    `
  pointer-events: none;
  opacity: 0.4;
  `}
  &:hover {
    cursor: pointer;
    background-color: #e0e0e0;
  }
`

const QuizCardTitle = styled.div`
  position: relative;
  font-size: 24px;
  font-weight: bold;
  font-family: ${headingFont};
`

const QuizCardDescription = styled.div`
  margin-top: 6px;
  font-size: 17px;
  word-wrap: break-word;
  color: #767b85;
`

const QuizItemOption: React.FC<QuizOptionProps> = ({ quizOption }) => {
  const { t } = useTranslation()

  const { type, name, description, disabled } = quizOption

  const { updateState } = useQuizzesExerciseServiceOutputState<PrivateSpecQuiz>((draft) => {
    if (!draft) {
      return null
    }
    return draft
  })

  const createQuizItem = () => {
    updateState((draft) => {
      if (!draft) {
        return
      }
      draft.items = [...draft.items, createEmptyQuizItem(type)]
    })
  }

  return (
    <QuizCard
      disabled={disabled}
      onClick={createQuizItem}
      role="button"
      id={`quiz-option-card-${type}`}
    >
      <QuizCardTitle>
        <Trans t={t}>{name}</Trans>
      </QuizCardTitle>
      <QuizCardDescription>
        <Trans t={t}>{description}</Trans>
      </QuizCardDescription>
    </QuizCard>
  )
}

export default QuizItemOption
