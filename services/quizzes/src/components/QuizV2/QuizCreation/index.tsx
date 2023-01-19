import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { PrivateSpecQuiz } from "../../../../types/quizTypes"
import useQuizzesExerciseServiceOutputState from "../../../hooks/useQuizzesExerciseServiceOutputState"
import Button from "../../../shared-module/components/Button"
import QuizEditor from "../QuizComponents/QuizEditor"
import { createEmptyQuizItem } from "../utils/general"

import QuizItemOption, { QuizOption } from "./QuizOption"

interface QuizOptionProps {
  [key: string]: QuizOption
}

const QUIZ_COMPONENTS: QuizOptionProps = {
  essay: {
    type: "essay",
    name: "quiz-essay-name",
    description: "quiz-essay-description",
    disabled: false,
    category: "input",
  },
  "multiple-choice": {
    type: "multiple-choice",
    name: "quiz-multiple-choice-name",
    description: "quiz-multiple-choice-description",
    disabled: false,
    category: "multiple-choice",
  },
  scale: {
    type: "scale",
    name: "quiz-scale-name",
    description: "quiz-scale-description",
    disabled: false,
    category: "other",
  },
  checkbox: {
    type: "checkbox",
    name: "quiz-checkbox-name",
    description: "quiz-checkbox-description",
    disabled: false,
    category: "other",
  },
  "closed-ended-question": {
    type: "closed-ended-question",
    name: "quiz-open-name",
    description: "quiz-open-description",
    disabled: false,
    category: "input",
  },
  matrix: {
    type: "matrix",
    name: "quiz-matrix-name",
    description: "quiz-matrix-description",
    disabled: false,
    category: "other",
  },
  timeline: {
    type: "timeline",
    name: "quiz-timeline-name",
    description: "quiz-timeline-description",
    disabled: false,
    category: "other",
  },
  "multiple-choice-dropdown": {
    type: "multiple-choice-dropdown",
    name: "quiz-multiple-choice-dropdown-name",
    description: "quiz-multiple-choice-dropdown-description",
    disabled: false,
    category: "multiple-choice",
  },
  "choose-n": {
    type: "choose-n",
    name: "quiz-clickable-multiple-choice-name",
    description: "quiz-multiple-choice-description",
    disabled: false,
    category: "multiple-choice",
  },
}

const AddQuizItemWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
`

const TypeContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  margin-top: 1rem;
  margin-bottom: 1rem;
`

const DuplicateContainer = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  margin-top: 1rem;
  margin-bottom: 1rem;
`

const QuizItemSectionTitle = styled.h4`
  font-weight: bold;
`

const QuizItemSelection: React.FC = () => {
  const { t } = useTranslation()

  return (
    <AddQuizItemWrapper>
      <QuizItemSectionTitle> {t("multiple-choice-header")} </QuizItemSectionTitle>
      <TypeContainer>
        {Object.values(QUIZ_COMPONENTS)
          .filter((item) => item.category === "multiple-choice")
          .map((item) => (
            <QuizItemOption key={item.type} quizOption={item} />
          ))}
      </TypeContainer>
      <QuizItemSectionTitle> {t("input-header")} </QuizItemSectionTitle>
      <TypeContainer>
        {Object.values(QUIZ_COMPONENTS)
          .filter((item) => item.category === "input")
          .map((item) => (
            <QuizItemOption key={item.type} quizOption={item} />
          ))}
      </TypeContainer>
      <QuizItemSectionTitle> {t("specialized-header")} </QuizItemSectionTitle>
      <TypeContainer>
        {Object.values(QUIZ_COMPONENTS)
          .filter((item) => item.category === "other")
          .map((item) => (
            <QuizItemOption key={item.type} quizOption={item} />
          ))}
      </TypeContainer>
    </AddQuizItemWrapper>
  )
}

interface AddQuizItemProps {
  quiz: PrivateSpecQuiz
}

const QuizDuplicationMenu: React.FC<AddQuizItemProps> = () => {
  const { t } = useTranslation()
  const { updateState } = useQuizzesExerciseServiceOutputState<PrivateSpecQuiz>((quiz) => {
    if (!quiz) {
      return null
    }
    return quiz
  })

  return (
    <AddQuizItemWrapper>
      <div
        className={css`
          text-align: center;
          width: 100%;
        `}
      >
        <h3>{t("add-new-quiz-item")}</h3>
        <p>{t("explain-add-new-quiz-item")}</p>
      </div>
      <TypeContainer>
        <DuplicateContainer>
          <Button
            title={t("create-quiz-item-same-type")}
            variant="outlined"
            transform="capitalize"
            onClick={() => {
              // TODO: implement
              updateState((quiz) => {
                if (!quiz) {
                  return null
                }
                quiz.items = [
                  ...quiz.items,
                  createEmptyQuizItem(quiz.items[quiz.items.length - 1].type),
                ]
              })
            }}
            size={"medium"}
            className={css`
              margin-bottom: 1rem;
              margin-left: 1rem;
            `}
          >
            {t("create-quiz-item-same-type")}
          </Button>
          <Button
            title={t("create-quiz-item-duplicate")}
            variant="outlined"
            transform="capitalize"
            size={"medium"}
            className={css`
              margin-bottom: 1rem;
              margin-left: 1rem;
            `}
            onClick={() => {
              // TODO: implement
              updateState((quiz) => {
                if (!quiz) {
                  return null
                }
                // Same values except id
                quiz.items = [...quiz.items, { ...quiz.items[quiz.items.length - 1], id: v4() }]
              })
            }}
          >
            {t("create-quiz-item-duplicate")}
          </Button>
        </DuplicateContainer>
      </TypeContainer>
    </AddQuizItemWrapper>
  )
}

export const AddQuizItem: React.FC<AddQuizItemProps> = ({ quiz }) => (
  <>{quiz.items.length > 0 ? <QuizDuplicationMenu quiz={quiz} /> : <QuizItemSelection />}</>
)

const ItemsTitleContainer = styled.div`
  display: flex;
  margin-bottom: 1.5rem;
  justify-content: center;
`

const SubsectionTitleWrapper = styled.div`
  display: flex;
  width: auto;
  margin-top: 1rem;
`

const QuizItemContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

interface QuizItemProps {
  quiz: PrivateSpecQuiz | null
}

const QuizItems: React.FC<QuizItemProps> = ({ quiz }) => {
  const { t } = useTranslation()

  if (!quiz) {
    return null
  }

  return (
    <>
      <ItemsTitleContainer>
        <SubsectionTitleWrapper>
          <h2>{t("quiz-items")}</h2>
        </SubsectionTitleWrapper>
      </ItemsTitleContainer>
      <QuizItemContainer>
        {quiz.items.map((quizItem) => {
          return (
            <div key={quizItem.id}>
              <QuizEditor quizItem={quizItem} />
            </div>
          )
        })}
        <AddQuizItem quiz={quiz} />
      </QuizItemContainer>
    </>
  )
}
export default QuizItems
