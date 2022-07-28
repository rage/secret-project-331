import styled from "@emotion/styled"
import { faSitemap } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Divider } from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"

import { useTypedSelector } from "../../store/store"

import AddQuizItem from "./AddQuizItem"
import QuizItem from "./QuizItem"

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

const TitleIcon = styled(FontAwesomeIcon)`
  width: 2rem;
  height: 2rem;
  margin-right: 0.25rem;
`

const QuizItems: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  const storeItems = Object.values(useTypedSelector((state) => state.editor.items))

  storeItems.sort((item1, item2) => item1.order - item2.order)
  return (
    <>
      <ItemsTitleContainer>
        <SubsectionTitleWrapper>
          <TitleIcon icon={faSitemap} />
          <h2>{t("quiz-items")}</h2>
        </SubsectionTitleWrapper>{" "}
      </ItemsTitleContainer>
      {storeItems.map((item) => {
        return (
          <div key={item.id}>
            <QuizItem item={item} />
            <Divider variant="fullWidth" />
          </div>
        )
      })}
      <AddQuizItem />
    </>
  )
}

export default QuizItems
