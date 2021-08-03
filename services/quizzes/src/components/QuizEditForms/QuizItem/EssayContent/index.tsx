import { faPen, faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Button, Fade, Modal, TextField } from "@material-ui/core"
import React from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { deletedItem } from "../../../../store/editor/editorActions"
import { setAdvancedEditing } from "../../../../store/editor/itemVariables/itemVariableActions"
import {
  editedItemMaxWords,
  editedItemMinWords,
  editedQuizItemTitle,
} from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import { NormalizedItem } from "../../../../types/NormalizedQuiz"
import MarkdownEditor from "../../../MarkdownEditor"

import EssayModalContent from "./EssayModalContent"

const InfoContainer = styled.div`
  padding: 1rem 0;
`

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

const AdvancedBox = styled(Box)`
  background-color: #fafafa !important;
  min-width: 80% !important;
  min-height: 50% !important;
  max-width: 80% !important;
  max-height: 50% !important;
  overflow-y: scroll !important;
`

const CloseButton = styled(Button)`
  display: flex !important;
`

const ModalButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
`

const DeleteButton = styled(Button)`
  display: flex !important;
`

const EditButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end !important;
`

interface EssayContentProps {
  item: NormalizedItem
}

const EssayContent: React.FC<EssayContentProps> = ({ item }) => {
  const quizId = useTypedSelector((state) => state.editor.quizId)
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])

  const dispatch = useDispatch()

  return (
    <>
      <EditButtonWrapper>
        <Button onClick={() => dispatch(setAdvancedEditing(storeItem.id, true))} title="edit item">
          <FontAwesomeIcon icon={faPen} size="2x"></FontAwesomeIcon>
        </Button>
      </EditButtonWrapper>
      <StyledModal
        open={variables.advancedEditing}
        onClose={() => dispatch(setAdvancedEditing(storeItem.id, false))}
      >
        <Fade in={variables.advancedEditing}>
          <AdvancedBox>
            <ModalButtonWrapper>
              <CloseButton onClick={() => dispatch(setAdvancedEditing(storeItem.id, false))}>
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
      <InfoContainer>
        <MarkdownEditor
          label="Description for this quiz item"
          onChange={(event) => dispatch(editedQuizItemTitle(event.target.value, storeItem.id))}
          text={storeItem.title ?? ""}
        />
      </InfoContainer>
      <OneLineInfoContainer>
        <InlineFieldWrapper>
          <TextField
            fullWidth
            label="Min words"
            variant="outlined"
            value={storeItem.minWords ?? ""}
            type="number"
            onChange={(event) =>
              dispatch(editedItemMinWords(storeItem.id, Number(event.target.value)))
            }
          />
        </InlineFieldWrapper>
        <InlineFieldWrapper>
          <TextField
            fullWidth
            label="Max words"
            variant="outlined"
            value={storeItem.maxWords ?? ""}
            type="number"
            onChange={(event) =>
              dispatch(editedItemMaxWords(storeItem.id, Number(event.target.value)))
            }
          />
        </InlineFieldWrapper>
      </OneLineInfoContainer>
    </>
  )
}

export default EssayContent
