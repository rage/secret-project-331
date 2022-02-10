import styled from "@emotion/styled"
import { faPen, faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Button, Fade, Modal } from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../../types/types"
import { deletedItem } from "../../../../store/editor/editorActions"
import { setAdvancedEditing } from "../../../../store/editor/itemVariables/itemVariableActions"
import { useTypedSelector } from "../../../../store/store"

import CustomModalContent from "./CustomModalContent"

interface CustomFrontendProps {
  item: NormalizedQuizItem
}

// eslint-disable-next-line i18next/no-literal-string
const EmptyBox = styled(Box)`
  width: 100% !important;
  height: 200px !important;
`

const EditButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
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

// eslint-disable-next-line i18next/no-literal-string
const DeleteButton = styled(Button)`
  display: flex !important;
`

const ModalButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
`

export const CustomFrontend: React.FC<CustomFrontendProps> = ({ item }) => {
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
            <CustomModalContent />
            <ModalButtonWrapper>
              <DeleteButton onClick={() => dispatch(deletedItem(storeItem.id, quizId))}>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <FontAwesomeIcon icon={faTrash} size="2x" color="red" />
              </DeleteButton>
            </ModalButtonWrapper>
          </AdvancedBox>
        </Fade>
      </StyledModal>
      <EditButtonWrapper>
        <Button onClick={() => dispatch(setAdvancedEditing(storeItem.id, true))}>
          <FontAwesomeIcon icon={faPen} size="2x" />
        </Button>
      </EditButtonWrapper>
      <EmptyBox />
    </>
  )
}

export default CustomFrontend
