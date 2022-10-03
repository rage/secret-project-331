import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../../types/types"
import TextField from "../../../../shared-module/components/InputFields/TextField"
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

export const EssayModalContent: React.FC<React.PropsWithChildren<ModalContentProps>> = ({
  item,
}) => {
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
          label={t("max-words")}
          value={String(item.maxWords) ?? ""}
          type="number"
          onChange={(value) => dispatch(editedItemMaxWords(item.id, Number(value)))}
        />
        <MinWords
          label={t("min-words")}
          value={String(item.minWords) ?? ""}
          type="number"
          onChange={(value) => dispatch(editedItemMinWords(item.id, Number(value)))}
        />
      </ModalContent>
    </>
  )
}

export default EssayModalContent
