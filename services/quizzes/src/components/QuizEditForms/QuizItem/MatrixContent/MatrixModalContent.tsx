import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { NormalizedQuizItem } from "../../../../../types/types"
import {
  editedItemFailureMessage,
  editedItemSuccessMessage,
  editedQuizItemTitle,
  editedSharedOptionsFeedbackMessage,
} from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"
import { ModalWrapper } from "../../../Shared/Modal"

import TableContent from "./TableContent"

const ModalContent = styled.div`
  display: flex;
  padding: 1rem;
  justify-content: center;
  @media only screen and (max-width: 600px) {
    width: 100%;
  }
`
const ModalContentTitleWrapper = styled.div`
  display: flex;
  padding: 1rem;
  justify-content: center;
  @media only screen and (max-width: 600px) {
    width: auto !important;
  }
`
const Spacer = styled.div`
  margin: 5% 0;
`

interface EditorModalProps {
  item: NormalizedQuizItem
}

export const MatrixModalContent: React.FC<EditorModalProps> = ({ item }) => {
  const { t } = useTranslation()
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const dispatch = useDispatch()

  return (
    <ModalWrapper>
      <ModalContentTitleWrapper>
        <h4>{t("title-advanced-editing")}</h4>
      </ModalContentTitleWrapper>
      <ModalContent>
        <MarkdownEditor
          label={t("title")}
          onChange={(value) => dispatch(editedQuizItemTitle(value, storeItem.id))}
          text={storeItem.title}
        />
      </ModalContent>
      <TableContent item={item}> </TableContent>
      <Spacer />
      {/* eslint-disable-next-line i18next/no-literal-string */}
      {storeItem.usesSharedOptionFeedbackMessage ? (
        <ModalContent>
          <MarkdownEditor
            label={t("shared-feedback-message-option")}
            onChange={(value) => dispatch(editedSharedOptionsFeedbackMessage(storeItem.id, value))}
            text={storeItem.sharedOptionFeedbackMessage ?? ""}
          />
        </ModalContent>
      ) : (
        <>
          <ModalContent>
            <MarkdownEditor
              label={t("success-message")}
              onChange={(value) => dispatch(editedItemSuccessMessage(storeItem.id, value))}
              text={storeItem.successMessage ?? ""}
            />
          </ModalContent>
          <ModalContent>
            <MarkdownEditor
              label={t("failure-message")}
              onChange={(value) => dispatch(editedItemFailureMessage(storeItem.id, value))}
              text={storeItem.failureMessage ?? ""}
            />
          </ModalContent>
        </>
      )}
    </ModalWrapper>
  )
}

export default MatrixModalContent
