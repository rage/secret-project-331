import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../types/types"
import Button from "../../../shared-module/components/Button"
import { createdDuplicateItem, createdNewItem } from "../../../store/editor/editorActions"

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

const DuplicateContainer = styled.div`
  display: flex;
  justify-content: center;
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

interface AddQuizItemProps {
  storeItems: NormalizedQuizItem[]
}

export const AddQuizItem: React.FC<AddQuizItemProps> = (storeItems) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  return (
    <>
      {storeItems.storeItems.length > 0 ? (
        <AddQuizItemWrapper>
          <h3>{t("add-new-quiz-item")}</h3>
          <DuplicateContainer>
            <Button
              title={t("open")}
              variant="outlined"
              transform="capitalize"
              onClick={() =>
                dispatch(
                  createdNewItem(storeItems.storeItems[0].quizId, storeItems.storeItems[0].type),
                )
              }
              size={"medium"}
              className={css`
                margin-bottom: 1rem;
                margin-left: 1rem;
              `}
            >
              {t("create-quiz-item-same-type")}
            </Button>
            <Button
              title={t("open")}
              variant="outlined"
              transform="capitalize"
              size={"medium"}
              className={css`
                margin-bottom: 1rem;
                margin-left: 1rem;
              `}
              onClick={() =>
                dispatch(
                  createdDuplicateItem(
                    storeItems.storeItems[storeItems.storeItems.length - 1].quizId,
                    storeItems.storeItems[storeItems.storeItems.length - 1],
                  ),
                )
              }
            >
              {t("create-quiz-item-duplicate")}
            </Button>
          </DuplicateContainer>
        </AddQuizItemWrapper>
      ) : (
        <AddQuizItemWrapper>
          <h3>{t("add-new-quiz-item")}</h3>
          <TypeContainer>
            {TYPES.map((type) => (
              <AddQuizItemButton key={type} type={type} />
            ))}
          </TypeContainer>
        </AddQuizItemWrapper>
      )}
    </>
  )
}

export default AddQuizItem
