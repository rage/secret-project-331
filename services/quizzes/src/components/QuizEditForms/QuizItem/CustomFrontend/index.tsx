import styled from "@emotion/styled"
import { faPen, faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Button, Fade } from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../../types/types"
import { deletedItem } from "../../../../store/editor/editorActions"
import { setAdvancedEditing } from "../../../../store/editor/itemVariables/itemVariableActions"
import { useTypedSelector } from "../../../../store/store"
import {
  AdvancedBox,
  AdvancedBoxModalOpenClass,
  CloseButton,
  DeleteButton,
  ModalButtonWrapper,
  StyledModal,
} from "../../../Shared/Modal"

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

export const CustomFrontend: React.FC<React.PropsWithChildren<CustomFrontendProps>> = ({
  item,
}) => {
  const { t } = useTranslation()
  const quizId = useTypedSelector((state) => state.editor.quizId)
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])
  const dispatch = useDispatch()
  return (
    <>
      <StyledModal
        open={variables.advancedEditing}
        onClose={() => dispatch(setAdvancedEditing({ itemId: storeItem.id, editing: false }))}
      >
        <Fade in={variables.advancedEditing}>
          <AdvancedBox
            className={AdvancedBoxModalOpenClass(variables.advancedEditingYAxisLocation)}
          >
            <ModalButtonWrapper>
              <CloseButton
                aria-label={t("close")}
                onClick={() =>
                  dispatch(setAdvancedEditing({ itemId: storeItem.id, editing: false }))
                }
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
        <Button
          onClick={(event) =>
            dispatch(
              setAdvancedEditing({
                itemId: storeItem.id,
                editing: true,
                mouseClickYPosition: event.pageY,
              }),
            )
          }
        >
          <FontAwesomeIcon icon={faPen} size="2x" />
        </Button>
      </EditButtonWrapper>
      <EmptyBox />
    </>
  )
}

export default CustomFrontend
