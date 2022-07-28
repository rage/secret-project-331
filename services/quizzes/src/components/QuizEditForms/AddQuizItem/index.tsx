import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import AddQuizItemButton from "./AddQuizItemButton"

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

const TYPES = [
  "essay",
  "scale",
  "open",
  "multiple-choice",
  "checkbox",
  "matrix",
  "multiple-choice-dropdown",
  "clickable-multiple-choice",
  "timeline",
]

export const AddQuizItem: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  return (
    <>
      <AddQuizItemWrapper>
        <h3>{t("add-new-quiz-item")}</h3>
        <TypeContainer>
          {TYPES.map((type) => (
            <AddQuizItemButton key={type} type={type} />
          ))}
        </TypeContainer>
      </AddQuizItemWrapper>
    </>
  )
}

export default AddQuizItem
