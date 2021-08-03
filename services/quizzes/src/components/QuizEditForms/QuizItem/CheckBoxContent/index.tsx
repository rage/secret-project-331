import { faPen, faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Box, Button, Checkbox, Fade, Modal } from "@material-ui/core"
import React from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { deletedItem } from "../../../../store/editor/editorActions"
import { setAdvancedEditing } from "../../../../store/editor/itemVariables/itemVariableActions"
import { editedQuizItemTitle } from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import { NormalizedItem } from "../../../../types/NormalizedQuiz"
import MarkdownEditor from "../../../MarkdownEditor"

import CheckBoxModalContent from "./CheckBoxModalContent"

interface ContentBoxProps {
  item: NormalizedItem
}

const Container = styled.div`
  display: flex;
  padding: 1rem;
  justify-content: space-between;
`

const TitleField = styled.div`
  display: flex !important;
  width: 50%;
`

const PreviewField = styled.div`
  display: flex !important;
  justify-content: center;
  align-items: center;
  width: 50%;
`

const StyledCheckBox = styled(Checkbox)`
  display: flex !important;
  justify-content: flex-end !important;
  width: 20% !important;
`

const CheckBoxTitleField = styled.div`
  display: flex !important;
  width: 80% !important;
`

const StyledTypo = styled.h4`
  display: flex !important;
  align-self: flex-start !important;
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

const DeleteButton = styled(Button)`
  display: flex !important;
`

const ModalButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
`

const EditButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end !important;
`

const CheckBoxContent: React.FC<ContentBoxProps> = ({ item }) => {
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const quizId = useTypedSelector((state) => state.editor.quizId)
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
            <CheckBoxModalContent itemId={storeItem.id} />
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
      <Container>
        <TitleField>
          <MarkdownEditor
            label="title"
            onChange={(event) => dispatch(editedQuizItemTitle(event.target.value, storeItem.id))}
            text={storeItem.title ?? ""}
          />
        </TitleField>
        <PreviewField>
          <StyledCheckBox disableRipple={true} disableFocusRipple={true} />
          <CheckBoxTitleField>
            <StyledTypo>{storeItem.title}</StyledTypo>
          </CheckBoxTitleField>
        </PreviewField>
      </Container>
    </>
  )
}

export default CheckBoxContent
