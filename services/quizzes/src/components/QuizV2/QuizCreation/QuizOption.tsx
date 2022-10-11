import styled from "@emotion/styled"
import React from "react"
import { Trans, useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { QuizItemType } from "../../../../types/quizTypes"

import { headingFont } from "../../../shared-module/styles"
import { createdNewItem } from "../../../store/editor/editorActions"
import { useTypedSelector } from "../../../store/store"

export interface QuizOption {
  type: QuizItemType
  name: string
  description: string
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
  ${(props) => Boolean(props.disabled) && `
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


const QuizItemOption: React.FC<QuizOptionProps> = ({ quizOption }) => {
  const { t } = useTranslation()

  const {type, name, description, disabled} = quizOption

  const dispatch = useDispatch()
  const quizId = useTypedSelector((state) => state.editor.quizId)

  const createQuizItem = () => {
    dispatch(createdNewItem(quizId, type))
  }

  return (
    <QuizCard disabled={disabled} onClick={createQuizItem} role="button" id={`quiz-option-card-${type}`}>
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
