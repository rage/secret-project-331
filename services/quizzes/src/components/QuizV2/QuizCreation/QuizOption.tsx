import styled from "@emotion/styled"
import React from "react"
import { Trans, useTranslation } from "react-i18next"
import { v4 } from "uuid"

import {
  PrivateSpecQuiz,
  PrivateSpecQuizItemCheckbox,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemClosedEndedQuestion,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemMultiplechoiceDropdown,
  PrivateSpecQuizItemScale,
  PrivateSpecQuizItemTimeline,
  QuizItemType,
} from "../../../../types/quizTypes"
import useQuizzesExerciseServiceOutputState from "../../../hooks/useQuizzesExerciseServiceOutputState"
import { headingFont } from "../../../shared-module/styles"

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
  width: 340px;
  height: 110px;
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
  color: #767b85;
`

const createEmptyQuizItem = (type: QuizItemType) => {
  switch (type) {
    case "checkbox":
      return {
        type,
        id: v4(),
        body: "",
        failureMessage: "",
        order: 0,
        successMessage: "",
        title: "",
      } as PrivateSpecQuizItemCheckbox
    case "choose-n":
      return {
        type,
        id: v4(),
        failureMessage: "",
        options: [],
        order: 0,
        successMessage: "",
        title: "",
        body: "",
      } as PrivateSpecQuizItemChooseN
    case "closed-ended-question":
      return {
        type,
        id: v4(),
        body: "",
        failureMessage: "",
        formatRegex: "",
        order: 0,
        successMessage: "",
        title: "",
        validityRegex: "",
      } as PrivateSpecQuizItemClosedEndedQuestion
    case "essay":
      return {
        type,
        id: v4(),
        body: "",
        failureMessage: "",
        maxWords: 150,
        minWords: 0,
        order: 0,
        successMessage: "",
        title: "",
      } as PrivateSpecQuizItemEssay
    case "matrix":
      return {
        type,
        id: v4(),
        optionCells: [],
        order: 0,
        successMessage: "",
        failureMessage: "",
      } as PrivateSpecQuizItemMatrix
    case "multiple-choice":
      return {
        type,
        id: v4(),
        allowSelectingMultipleOptions: true,
        body: "",
        // eslint-disable-next-line i18next/no-literal-string
        direction: "row",
        failureMessage: "",
        // eslint-disable-next-line i18next/no-literal-string
        multipleChoiceMultipleOptionsGradingPolicy: "default",
        options: [],
        order: 0,
        sharedOptionFeedbackMessage: "",
        shuffleOptions: false,
        successMessage: "",
        title: "",
      } as PrivateSpecQuizItemMultiplechoice
    case "multiple-choice-dropdown":
      return {
        type,
        id: v4(),
        allowSelectingMultipleOptions: true,
        body: "",
        // eslint-disable-next-line i18next/no-literal-string
        direction: "row",
        failureMessage: "",
        // eslint-disable-next-line i18next/no-literal-string
        multipleChoiceMultipleOptionsGradingPolicy: "default",
        options: [],
        order: 0,
        sharedOptionFeedbackMessage: "",
        shuffleOptions: false,
        successMessage: "",
        title: "",
      } as PrivateSpecQuizItemMultiplechoiceDropdown
    case "scale":
      return {
        type,
        id: v4(),
        failureMessage: "",
        maxLabel: "",
        maxValue: 5,
        minLabel: "",
        minValue: 0,
        order: 0,
        successMessage: "",
        title: "",
        body: "",
      } as PrivateSpecQuizItemScale
    case "timeline":
      return {
        type,
        id: v4(),
        failureMessage: "",
        order: 0,
        successMessage: "",
        timelineItems: [],
      } as PrivateSpecQuizItemTimeline
  }
}

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
