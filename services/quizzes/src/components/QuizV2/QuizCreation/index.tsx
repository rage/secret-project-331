import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { NormalizedQuizItem } from "../../../../types/types"
import Button from "../../../shared-module/components/Button"
import { useTypedSelector } from "../../../store/store"
import {
  convertNormalizedQuizItemOptionsToQuizItemOptions,
  migrateQuizItem,
} from "../../../util/quizMigration"
import QuizEditor from "../QuizComponents/QuizEditor"

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
  },
  "multiple-choice": {
    type: "multiple-choice",
    name: "quiz-multiple-choice-name",
    description: "quiz-multiple-choice-description",
    disabled: false,
  },
  scale: {
    type: "scale",
    name: "quiz-scale-name",
    description: "quiz-scale-description",
    disabled: false,
  },
  checkbox: {
    type: "checkbox",
    name: "quiz-checkbox-name",
    description: "quiz-checkbox-description",
    disabled: false,
  },
  "closed-ended-question": {
    type: "closed-ended-question",
    name: "quiz-open-name",
    description: "quiz-open-description",
    disabled: false,
  },
  matrix: {
    type: "matrix",
    name: "quiz-matrix-name",
    description: "quiz-matrix-description",
    disabled: true,
  },
  timeline: {
    type: "timeline",
    name: "quiz-timeline-name",
    description: "quiz-timeline-description",
    disabled: true,
  },
  "choose-n": {
    type: "choose-n",
    name: "quiz-clickable-multiple-choice-name",
    description: "quiz-multiple-choice-description",
    disabled: true,
  },
  // "multiple-choice-dropdown": {
  //   name: "quiz-multiple-choice-dropdown-name",
  //   description: "quiz-multiple-choice-dropdown-description",
  // }
}

const AddQuizItemWrapper = styled.div`
  display: flex;
  margin-top: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  justify-content: space-around;
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

const QuizItemSelection: React.FC = () => {
  const { t } = useTranslation()

  return (
    <AddQuizItemWrapper>
      <h3>{t("add-new-quiz-item")}</h3>
      <TypeContainer>
        {Object.keys(QUIZ_COMPONENTS).map((type, _) => (
          <QuizItemOption key={type} quizOption={QUIZ_COMPONENTS[type]} />
        ))}
      </TypeContainer>
    </AddQuizItemWrapper>
  )
}

interface AddQuizItemProps {
  storeItems: NormalizedQuizItem[]
}

const QuizDuplicationMenu: React.FC<AddQuizItemProps> = () => {
  const { t } = useTranslation()

  return (
    <AddQuizItemWrapper>
      <div
        className={css`
          text-align: center;
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
            }}
          >
            {t("create-quiz-item-duplicate")}
          </Button>
        </DuplicateContainer>
      </TypeContainer>
    </AddQuizItemWrapper>
  )
}

export const AddQuizItem: React.FC<AddQuizItemProps> = (storeItems) => (
  <>
    {storeItems.storeItems.length > 0 ? (
      <QuizDuplicationMenu storeItems={storeItems.storeItems} />
    ) : (
      <QuizItemSelection />
    )}
  </>
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

const QuizItems: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  const storeItems = Object.values(useTypedSelector((state) => state.editor.items))
  const storeOptions = useTypedSelector((state) => state.editor.options)
  storeItems.sort((item1, item2) => item1.order - item2.order)

  return (
    <>
      <ItemsTitleContainer>
        <SubsectionTitleWrapper>
          <h2>{t("quiz-items")}</h2>
        </SubsectionTitleWrapper>{" "}
      </ItemsTitleContainer>
      <QuizItemContainer>
        {storeItems.map((oldQuiz) => {
          const quiz = migrateQuizItem(oldQuiz)
          if (quiz.type == "multiple-choice") {
            const quizOptions = oldQuiz.options.map((itemId) => storeOptions[itemId])
            quiz.options = convertNormalizedQuizItemOptionsToQuizItemOptions(quizOptions)
          }
          return (
            <div key={quiz.id}>
              <QuizEditor quizItem={quiz} />
            </div>
          )
        })}
        <AddQuizItem storeItems={storeItems} />
      </QuizItemContainer>
    </>
  )
}
export default QuizItems
