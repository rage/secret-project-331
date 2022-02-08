import { TextField } from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { NormalizedQuizItem } from "../../../../../types/types"
import {
  editedItemMaxWords,
  editedItemMinWords,
  editedQuizItemBody,
} from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"
import { ModalContent, ModalContentTitleWrapper } from "../../../Shared/Modal"

// eslint-disable-next-line i18next/no-literal-string
const MaxWords = styled(TextField)`
  display: flex !important;
  margin-right: 0.5rem !important;
`

// eslint-disable-next-line i18next/no-literal-string
const MinWords = styled(TextField)`
  display: flex !important;
  margin-left: 0.5rem !important;
`

interface ModalContentProps {
  item: NormalizedQuizItem
}

export const EssayModalContent: React.FC<ModalContentProps> = ({ item }) => {
  const { t } = useTranslation()
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const dispatch = useDispatch()
  return (
    <>
      <ModalContentTitleWrapper>
        <h3>{t("title-advanced-editing")}</h3>
      </ModalContentTitleWrapper>
      <ModalContent>
        <MarkdownEditor
          label={t("description-for-quiz-item")}
          text={storeItem.body ?? ""}
          onChange={(value) => dispatch(editedQuizItemBody(value, storeItem.id))}
        />
      </ModalContent>
      <ModalContent>
        <MaxWords
          fullWidth
          label={t("max-words")}
          variant="outlined"
          value={item.maxWords ?? ""}
          type="number"
          onChange={(event) => dispatch(editedItemMaxWords(item.id, Number(event.target.value)))}
        />
        <MinWords
          fullWidth
          label={t("min-words")}
          variant="outlined"
          value={item.minValue ?? ""}
          type="number"
          onChange={(event) => dispatch(editedItemMinWords(item.id, Number(event.target.value)))}
        />
      </ModalContent>
    </>
  )
}

export default EssayModalContent
