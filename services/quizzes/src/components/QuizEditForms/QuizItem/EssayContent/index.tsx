import { faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Button, Fade, Modal } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { NormalizedQuizItem } from "../../../../../types/types"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import { deletedItem } from "../../../../store/editor/editorActions"
import { setAdvancedEditing } from "../../../../store/editor/itemVariables/itemVariableActions"
import { editedItemMaxWords, editedItemMinWords } from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"

import EssayModalContent from "./EssayModalContent"

const OneLineInfoContainer = styled.div`
  padding: 1rem 0;
  display: flex;
`

const InlineFieldWrapper = styled.div`
  &:not(:last-of-type) {
    margin-right: 1rem;
  }
  width: 100%;
`

const StyledModal = styled(Modal)`
  display: flex;
  align-items: center;
  justify-content: center;
`

// eslint-disable-next-line i18next/no-literal-string
const AdvancedBox = styled(Box)`
  background-color: #fafafa !important;
  min-width: 80% !important;
  max-width: 80% !important;
  max-height: 50% !important;
  overflow-y: scroll !important;
`

// eslint-disable-next-line i18next/no-literal-string
const CloseButton = styled(Button)`
  display: flex !important;
`

const ModalButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
`

// eslint-disable-next-line i18next/no-literal-string
const DeleteButton = styled(Button)`
  display: flex !important;
`

interface EssayContentProps {
  item: NormalizedQuizItem
}

const EssayContent: React.FC<EssayContentProps> = ({ item }) => {
  const { t } = useTranslation()
  const quizId = useTypedSelector((state) => state.editor.quizId)
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])

  const dispatch = useDispatch()

  return (
    <>
      <StyledModal
        open={variables.advancedEditing}
        onClose={() => dispatch(setAdvancedEditing(storeItem.id, false))}
      >
        <Fade in={variables.advancedEditing}>
          <AdvancedBox>
            <ModalButtonWrapper>
              <CloseButton
                aria-label={t("close")}
                onClick={() => dispatch(setAdvancedEditing(storeItem.id, false))}
              >
                <FontAwesomeIcon icon={faWindowClose} size="2x" />
              </CloseButton>
            </ModalButtonWrapper>
            <EssayModalContent item={storeItem} />
            <ModalButtonWrapper>
              <DeleteButton
                onClick={() => {
                  dispatch(deletedItem(storeItem.id, quizId))
                }}
              >
                <FontAwesomeIcon icon={faTrash} size="2x" color="red" />
              </DeleteButton>
            </ModalButtonWrapper>
          </AdvancedBox>
        </Fade>
      </StyledModal>
      <OneLineInfoContainer>
        <InlineFieldWrapper>
          <TextField
            label={t("min-words")}
            value={storeItem.minWords?.toString() ?? ""}
            type="number"
            onChange={(value) => dispatch(editedItemMinWords(storeItem.id, Number(value)))}
          />
        </InlineFieldWrapper>
        <InlineFieldWrapper>
          <TextField
            label={t("max-words")}
            value={storeItem.maxWords?.toString() ?? ""}
            type="number"
            onChange={(value) => dispatch(editedItemMaxWords(storeItem.id, Number(value)))}
          />
        </InlineFieldWrapper>
      </OneLineInfoContainer>
    </>
  )
}

export default EssayContent
