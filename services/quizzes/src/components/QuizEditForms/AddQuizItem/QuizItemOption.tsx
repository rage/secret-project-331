import styled from "@emotion/styled"
import React from "react"
import { Trans, useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { createdNewItem } from "../../../store/editor/editorActions"
import { useTypedSelector } from "../../../store/store"

interface QuizItemOptionProps {
  type: string
}

interface IQuizItem {
  name: string
  description: string
}

interface IQuizComponents {
  [type: string]: IQuizItem
}

const QUIZ_COMPONENTS: IQuizComponents = {
  essay: {
    name: "quiz-essay-name",
    description: "quiz-essay-description",
  },
  scale: {
    name: "quiz-scale-name",
    description: "quiz-scale-description",
  },
  open: {
    name: "quiz-open-name",
    description: "quiz-open-description",
  },
  "multiple-choice": {
    name: "quiz-multiple-choice-name",
    description: "quiz-multiple-choice-description",
  },
  checkbox: {
    name: "quiz-checkbox-name",
    description: "quiz-checkbox-description",
  },
  matrix: {
    name: "quiz-matrix-name",
    description: "quiz-matrix-description",
  },
  "multiple-choice-dropdown": {
    name: "quiz-multiple-choice-dropdown-name",
    description: "quiz-multiple-choice-dropdown-description",
  },
  "clickable-multiple-choice": {
    name: "quiz-clickable-multiple-choice-name",
    description: "quiz-clickable-multiple-choice-description",
  },
  timeline: {
    name: "quiz-timeline-name",
    description: "quiz-timeline-description",
  },
}

const QuizCard = styled.div`
  all: unset;
  width: 340px;
  height: 110px;
  background-color: #f5f6f7;
  padding: 16px;
  margin: 5px;

  &:hover {
    cursor: pointer;
    background-color: #e0e0e0;
  }
`

const QuizCardTitle = styled.div`
  position: relative;
  font-size: 24px;
  font-weight: bold;
`

const QuizCardDescription = styled.div`
  margin-top: 6px;
  font-size: 17px;
  color: #767b85;
`

const QuizItemOption: React.FC<QuizItemOptionProps> = ({ type }) => {
  const { t } = useTranslation()

  const name = QUIZ_COMPONENTS[type].name
  const description = QUIZ_COMPONENTS[type].description

  const dispatch = useDispatch()
  const quizId = useTypedSelector((state) => state.editor.quizId)

  const createQuizItem = () => {
    dispatch(createdNewItem(quizId, type))
  }

  return (
    <QuizCard onClick={createQuizItem} role="button" id={`quiz-option-card-${type}`}>
      <QuizCardTitle>
        <Trans t={t}>{name}</Trans>
      </QuizCardTitle>
      <QuizCardDescription>
        <Trans t={t}>{description}</Trans>
      </QuizCardDescription>
    </QuizCard>
  )
}

export { QuizItemOption, QUIZ_COMPONENTS }
