import styled from "@emotion/styled"
import { faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Button, Fade, Modal } from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../../types/types"
import { deletedItem } from "../../../../store/editor/editorActions"
import { setAdvancedEditing } from "../../../../store/editor/itemVariables/itemVariableActions"
import { useTypedSelector } from "../../../../store/store"

import MatrixModalContent from "./MatrixModalContent"
import TableContent from "./TableContent"

const QuizContent = styled.div`
  padding: 1rem;
  display: flex;
  @media only screen and (max-width: 600px) {
    width: 100%;
  }
`

const QuizContentLineContainer = styled.div`
  display: flex !important;
  justify-content: space-around;
  @media only screen and (max-width: 600px) {
    flex-wrap: wrap;
  }
`

const StyledModal = styled(Modal)`
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  max-width: 100% !important;
  max-height: 100% !important;
`

const AdvancedBox = styled(Box)`
  background-color: #fafafa !important;
  max-width: 60% !important;
  max-height: 50% !important;
  overflow-y: scroll !important;
`

const CloseButton = styled(Button)`
  display: flex !important;
`

const DeleteButton = styled(Button)`
  display: flex !important;
`

const ModalButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
`

interface MatrixContentProps {
  item: NormalizedQuizItem
}

const MatrixContent: React.FC<MatrixContentProps> = ({ item }) => {
  const quizId = useTypedSelector((state) => state.editor.quizId)
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])

  const dispatch = useDispatch()
  const { t } = useTranslation()

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
            <MatrixModalContent item={storeItem} />
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
      <QuizContentLineContainer>
        <QuizContent>
          <TableContent item={item}> </TableContent>{" "}
        </QuizContent>
      </QuizContentLineContainer>
    </>
  )
}

export default MatrixContent
